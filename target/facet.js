// Generated by CoffeeScript 1.3.1
(function() {
  "use strict";

  var FacetJob, Interval, Segment, arraySubclass, checkStage, divideLength, facet, flatten, getProp, getScale, isValidStage, lineOnLine, lineOnPoint, pointOnLine, pointOnPoint, stripeTile, wrapLiteral,
    __slice = [].slice;

  window.facet = facet = {
    version: '0.2.1'
  };

  arraySubclass = [].__proto__ ? function(array, prototype) {
    array.__proto__ = prototype;
    return array;
  } : function(array, prototype) {
    var property, _i, _len;
    for (_i = 0, _len = prototype.length; _i < _len; _i++) {
      property = prototype[_i];
      array[property] = prototype[property];
    }
    return array;
  };

  flatten = function(ar) {
    return Array.prototype.concat.apply([], ar);
  };

  Interval = (function() {

    Interval.name = 'Interval';

    function Interval(start, end) {
      this.start = start;
      this.end = end;
      return;
    }

    Interval.prototype.transform = function(fn) {
      return null;
    };

    Interval.prototype.valueOf = function() {
      return this.end - this.start;
    };

    Interval.prototype.toString = function() {
      if (this.start instanceof Date) {
        return "[" + (this.start.toISOString()) + ", " + (this.end.toISOString()) + ")";
      } else {
        return "[" + (this.start.toPrecision(3)) + ", " + (this.end.toPrecision(3)) + ")";
      }
    };

    return Interval;

  })();

  Interval.fromArray = function(arr) {
    var end, endDate, endType, start, startDate, startType;
    if (arr.length !== 2) {
      throw new Error("Interval must have length of 2 (is: " + arr.length + ")");
    }
    start = arr[0], end = arr[1];
    startType = typeof start;
    endType = typeof end;
    if (startType === 'string' && endType === 'string') {
      startDate = new Date(start);
      if (isNaN(startDate.valueOf())) {
        throw new Error("bad start date '" + start + "'");
      }
      endDate = new Date(end);
      if (isNaN(endDate.valueOf())) {
        throw new Error("bad end date '" + end + "'");
      }
      return new Interval(startDate, endDate);
    }
    return new Interval(start, end);
  };

  isValidStage = function(stage) {
    return Boolean(stage && typeof stage.type === 'string' && stage.node);
  };

  Segment = (function() {

    Segment.name = 'Segment';

    function Segment(_arg) {
      var stage;
      this.parent = _arg.parent, stage = _arg.stage, this.prop = _arg.prop, this.splits = _arg.splits;
      if (!isValidStage(stage)) {
        throw "invalid stage";
      }
      this._stageStack = [stage];
      this.scale = {};
    }

    Segment.prototype.getStage = function() {
      return this._stageStack[this._stageStack.length - 1];
    };

    Segment.prototype.setStage = function(stage) {
      if (!isValidStage(stage)) {
        throw "invalid stage";
      }
      this._stageStack[this._stageStack.length - 1] = stage;
    };

    Segment.prototype.pushStage = function(stage) {
      if (!isValidStage(stage)) {
        throw "invalid stage";
      }
      this._stageStack.push(stage);
    };

    Segment.prototype.popStage = function() {
      if (this._stageStack.length < 2) {
        throw "must have at least one stage";
      }
      this._stageStack.pop();
    };

    return Segment;

  })();

  facet.split = {
    identity: function(attribute) {
      return {
        bucket: 'identity',
        attribute: attribute
      };
    },
    continuous: function(attribute, size, offset) {
      if (!size) {
        throw new Error("continuous split must have " + size);
      }
      if (offset == null) {
        offset = 0;
      }
      return {
        bucket: 'continuous',
        attribute: attribute,
        size: size,
        offset: offset
      };
    },
    time: function(attribute, duration) {
      if (duration !== 'second' && duration !== 'minute' && duration !== 'hour' && duration !== 'day') {
        throw new Error("Invalid duration '" + duration + "'");
      }
      return {
        bucket: 'time',
        attribute: attribute,
        duration: duration
      };
    }
  };

  facet.apply = {
    count: function() {
      return {
        aggregate: 'count'
      };
    },
    sum: function(attribute) {
      return {
        aggregate: 'sum',
        attribute: attribute
      };
    },
    average: function(attribute) {
      return {
        aggregate: 'average',
        attribute: attribute
      };
    },
    min: function(attribute) {
      return {
        aggregate: 'min',
        attribute: attribute
      };
    },
    max: function(attribute) {
      return {
        aggregate: 'max',
        attribute: attribute
      };
    },
    unique: function(attribute) {
      return {
        aggregate: 'unique',
        attribute: attribute
      };
    }
  };

  facet.sort = {
    natural: function(attribute, direction) {
      if (direction == null) {
        direction = 'descending';
      }
      return {
        compare: 'natural',
        attribute: attribute,
        direction: direction
      };
    },
    caseInsensetive: function(attribute, direction) {
      if (direction == null) {
        direction = 'descending';
      }
      return {
        compare: 'caseInsensetive',
        attribute: attribute,
        direction: direction
      };
    }
  };

  wrapLiteral = function(arg) {
    var _ref;
    if ((_ref = typeof arg) === 'undefined' || _ref === 'function') {
      return arg;
    } else {
      return facet.use.literal(arg);
    }
  };

  getProp = function(segment, propName) {
    var _ref;
    if (!segment) {
      throw new Error("No such prop '" + propName + "'");
    }
    return (_ref = segment.prop[propName]) != null ? _ref : getProp(segment.parent, propName);
  };

  getScale = function(segment, scaleName) {
    var _ref;
    if (!segment) {
      throw new Error("No such scale '" + scaleName + "'");
    }
    return (_ref = segment.scale[scaleName]) != null ? _ref : getScale(segment.parent, scaleName);
  };

  facet.use = {
    literal: function(value) {
      return function() {
        return value;
      };
    },
    prop: function(propName) {
      if (!propName) {
        throw new Error("must specify prop name");
      }
      if (typeof propName !== 'string') {
        throw new TypeError("prop name must be a string");
      }
      return function(segment) {
        return getProp(segment, propName);
      };
    },
    scale: function(scaleName, use) {
      if (!scaleName) {
        throw new Error("must specify scale name");
      }
      if (typeof scaleName !== 'string') {
        throw new TypeError("scale name must be a string");
      }
      return function(segment) {
        var scale;
        scale = getScale(segment, scaleName);
        if (scale.train) {
          throw new Error("'" + scaleName + "' scale is untrained");
        }
        use || (use = scale.use);
        return scale.fn(use(segment));
      };
    },
    stage: function(attr) {
      if (typeof attr !== 'string') {
        throw new Error("must specify attr");
      }
      if (attr === 'type') {
        throw new Error("attr can not be 'type'");
      }
      return function(segment) {
        return segment.getStage()[attr];
      };
    },
    interval: function(start, end) {
      start = wrapLiteral(start);
      end = wrapLiteral(end);
      return function(segment) {
        return new Interval(start(segment), end(segment));
      };
    },
    fn: function() {
      var args, fn, _i;
      args = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), fn = arguments[_i++];
      return function(segment) {
        if (typeof fn !== 'function') {
          throw new TypeError("second argument must be a function");
        }
        return fn.apply(this, args.map(function(arg) {
          return arg(segment);
        }));
      };
    }
  };

  facet.scale = {
    linear: function(_arg) {
      var nice;
      nice = (_arg != null ? _arg : {}).nice;
      return function(segments, _arg1) {
        var basicScale, domain, domainMax, domainMin, domainValue, include, range, rangeFrom, rangeTo, rangeValue, scaleFn, segment, _i, _len;
        include = _arg1.include, domain = _arg1.domain, range = _arg1.range;
        domain = wrapLiteral(domain);
        range = wrapLiteral(range);
        domainMin = Infinity;
        domainMax = -Infinity;
        rangeFrom = -Infinity;
        rangeTo = Infinity;
        if (include != null) {
          domainMin = Math.min(domainMin, include);
          domainMax = Math.max(domainMax, include);
        }
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          domainValue = domain(segment);
          if (domainValue instanceof Interval) {
            domainMin = Math.min(domainMin, domainValue.start);
            domainMax = Math.max(domainMax, domainValue.end);
          } else {
            domainMin = Math.min(domainMin, domainValue);
            domainMax = Math.max(domainMax, domainValue);
          }
          rangeValue = range(segment);
          if (rangeValue instanceof Interval) {
            rangeFrom = rangeValue.start;
            rangeTo = Math.min(rangeTo, rangeValue.end);
          } else {
            rangeFrom = 0;
            rangeTo = Math.min(rangeTo, rangeValue);
          }
        }
        if (!(isFinite(domainMin) && isFinite(domainMax) && isFinite(rangeFrom) && isFinite(rangeTo))) {
          throw new Error("we went into infinites");
        }
        basicScale = d3.scale.linear().domain([domainMin, domainMax]).range([rangeFrom, rangeTo]);
        if (nice) {
          basicScale.nice();
        }
        scaleFn = function(x) {
          if (x instanceof Interval) {
            return new Interval(basicScale(x.start), basicScale(x.end));
          } else {
            return basicScale(x);
          }
        };
        return {
          fn: scaleFn,
          use: domain
        };
      };
    },
    log: function(_arg) {
      var plusOne;
      plusOne = _arg.plusOne;
      return function(segments, _arg1) {
        var basicScale, domain, domainMax, domainMin, domainValue, include, range, rangeFrom, rangeTo, rangeValue, scaleFn, segment, _i, _len;
        domain = _arg1.domain, range = _arg1.range, include = _arg1.include;
        domain = wrapLiteral(domain);
        range = wrapLiteral(range);
        domainMin = Infinity;
        domainMax = -Infinity;
        rangeFrom = -Infinity;
        rangeTo = Infinity;
        if (include != null) {
          domainMin = Math.min(domainMin, include);
          domainMax = Math.max(domainMax, include);
        }
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          domainValue = domain(segment);
          if (domainValue instanceof Interval) {
            domainMin = Math.min(domainMin, domainValue.start);
            domainMax = Math.max(domainMax, domainValue.end);
          } else {
            domainMin = Math.min(domainMin, domainValue);
            domainMax = Math.max(domainMax, domainValue);
          }
          rangeValue = range(segment);
          if (rangeValue instanceof Interval) {
            rangeFrom = rangeValue.start;
            rangeTo = Math.min(rangeTo, rangeValue.end);
          } else {
            rangeFrom = 0;
            rangeTo = Math.min(rangeTo, rangeValue);
          }
        }
        if (!(isFinite(domainMin) && isFinite(domainMax) && isFinite(rangeFrom) && isFinite(rangeTo))) {
          throw new Error("we went into infinites");
        }
        basicScale = d3.scale.log().domain([domainMin, domainMax]).range([rangeFrom, rangeTo]);
        scaleFn = function(x) {
          if (x instanceof Interval) {
            return new Interval(basicScale(x.start), basicScale(x.end));
          } else {
            return x;
          }
        };
        return {
          fn: scaleFn,
          use: domain
        };
      };
    },
    color: function() {
      return function(segments, _arg) {
        var domain;
        domain = _arg.domain;
        domain = wrapLiteral(domain);
        return {
          fn: d3.scale.category10().domain(segments.map(domain)),
          use: domain
        };
      };
    }
  };

  divideLength = function(length, sizes) {
    var lengthPerSize, size, totalSize, _i, _len;
    totalSize = 0;
    for (_i = 0, _len = sizes.length; _i < _len; _i++) {
      size = sizes[_i];
      totalSize += size;
    }
    lengthPerSize = length / totalSize;
    return sizes.map(function(size) {
      return size * lengthPerSize;
    });
  };

  stripeTile = function(dim1, dim2) {
    return function(_arg) {
      var gap, size, _ref;
      _ref = _arg != null ? _arg : {}, gap = _ref.gap, size = _ref.size;
      gap || (gap = 0);
      size = wrapLiteral(size != null ? size : 1);
      return function(parentSegment, segmentGroup) {
        var availableDim1, dim1s, dimSoFar, maxGap, n, parentDim1, parentDim2, parentStage;
        n = segmentGroup.length;
        parentStage = parentSegment.getStage();
        if (parentStage.type !== 'rectangle') {
          throw new Error("Must have a rectangular stage (is " + parentStage.type + ")");
        }
        parentDim1 = parentStage[dim1];
        parentDim2 = parentStage[dim2];
        maxGap = Math.max(0, (parentDim1 - n * 2) / (n - 1));
        gap = Math.min(gap, maxGap);
        availableDim1 = parentDim1 - gap * (n - 1);
        dim1s = divideLength(availableDim1, segmentGroup.map(size));
        dimSoFar = 0;
        return segmentGroup.map(function(segment, i) {
          var curDim1, pseudoStage;
          curDim1 = dim1s[i];
          pseudoStage = {
            x: 0,
            y: 0,
            stage: {
              type: 'rectangle'
            }
          };
          pseudoStage[dim1 === 'width' ? 'x' : 'y'] = dimSoFar;
          pseudoStage.stage[dim1] = curDim1;
          pseudoStage.stage[dim2] = parentDim2;
          dimSoFar += curDim1 + gap;
          return pseudoStage;
        });
      };
    };
  };

  facet.layout = {
    overlap: function() {
      return {};
    },
    horizontal: stripeTile('width', 'height'),
    vertical: stripeTile('height', 'width'),
    horizontalScale: function(_arg) {
      var flip, scale, use;
      scale = _arg.scale, use = _arg.use, flip = _arg.flip;
      return function(parentSegment, segmentGroup) {
        var parentHeight, parentStage, parentWidth, scaleObj;
        parentStage = parentSegment.getStage();
        if (parentStage.type !== 'rectangle') {
          throw new Error("Must have a rectangular stage (is " + parentStage.type + ")");
        }
        parentWidth = parentStage.width;
        parentHeight = parentStage.height;
        scaleObj = getScale(segmentGroup[0], scale);
        use || (use = scaleObj.use);
        return segmentGroup.map(function(segment, i) {
          var int, width, x;
          int = scaleObj.fn(use(segment));
          x = int.start;
          width = int.end - int.start;
          if (flip) {
            x = parentWidth - x - width;
          }
          return {
            x: x,
            y: 0,
            stage: {
              type: 'rectangle',
              width: width,
              height: parentHeight
            }
          };
        });
      };
    },
    tile: function() {
      throw "not implemented yet";
    }
  };

  pointOnPoint = function(args, leftName, rightName) {
    var left, right;
    left = wrapLiteral(args[leftName]);
    right = wrapLiteral(args[rightName]);
    if (left) {
      if (right) {
        throw new Error("Over-constrained by " + leftName + " and " + rightName);
      } else {
        return left;
      }
    } else {
      if (right) {
        return function(segment) {
          return -right(segment);
        };
      } else {
        return function() {
          return 0;
        };
      }
    }
  };

  pointOnLine = function(args, leftName, rightName) {
    var left, right;
    left = wrapLiteral(args[leftName]);
    right = wrapLiteral(args[rightName]);
    if (left) {
      if (right) {
        throw new Error("Over-constrained by " + leftName + " and " + rightName);
      } else {
        return function(segment, stageWidth) {
          return left(segment);
        };
      }
    } else {
      if (right) {
        return function(segment, stageWidth) {
          return stageWidth - right(segment);
        };
      } else {
        return function(segment, stageWidth) {
          return stageWidth / 2;
        };
      }
    }
  };

  lineOnLine = function(args, leftName, widthName, rightName) {
    var flip, fn, left, right, width;
    left = wrapLiteral(args[leftName]);
    width = wrapLiteral(args[widthName]);
    right = wrapLiteral(args[rightName]);
    if (left && right) {
      if (width) {
        throw new Error("Over-constrained by " + widthName);
      }
      return function(segment, stageWidth) {
        var leftValue, rightValue;
        leftValue = left(segment);
        rightValue = right(segment);
        if (leftValue instanceof Interval || rightValue instanceof Interval) {
          throw new Error("Over-constrained by interval");
        }
        return [leftValue, stageWidth - leftValue - rightValue];
      };
    }
    flip = false;
    if (right && !left) {
      left = right;
      leftName = rightName;
      flip = true;
    }
    fn = width ? left ? function(segment, stageWidth) {
      var leftValue, widthValue;
      leftValue = left(segment);
      if (leftValue instanceof Interval) {
        throw new Error("Over-constrained by " + widthName);
      } else {
        widthValue = width(segment).valueOf();
        return [leftValue, widthValue];
      }
    } : function(segment, stageWidth) {
      var widthValue;
      widthValue = width(segment).valueOf();
      return [(stageWidth - widthValue) / 2, widthValue];
    } : left ? function(segment, stageWidth) {
      var leftValue;
      leftValue = left(segment);
      if (leftValue instanceof Interval) {
        return [leftValue.start, leftValue.end - leftValue.start];
      } else {
        return [leftValue, stageWidth - leftValue];
      }
    } : function(segment, stageWidth) {
      return [0, stageWidth];
    };
    if (flip) {
      return function(segment, stageWidth) {
        var pos;
        pos = fn(segment, stageWidth);
        pos[0] = stageWidth - pos[0] - pos[1];
        return pos;
      };
    } else {
      return fn;
    }
  };

  lineOnPoint = function(args, leftName, widthName, rightName) {
    var flip, fn, left, right, width;
    left = wrapLiteral(args[leftName]);
    width = wrapLiteral(args[widthName]);
    right = wrapLiteral(args[rightName]);
    if (left && right) {
      if (width) {
        throw new Error("Over-constrained by " + widthName);
      }
      return function(segment, stageWidth) {
        var leftValue, rightValue;
        leftValue = left(segment);
        rightValue = right(segment);
        if (leftValue instanceof Interval || rightValue instanceof Interval) {
          throw new Error("Over-constrained by interval");
        }
        return [-leftValue, leftValue + rightValue];
      };
    }
    flip = false;
    if (left && !right) {
      right = left;
      rightName = leftName;
      flip = true;
    }
    fn = (function() {
      if (width) {
        if (right) {
          return function(segment) {
            var rightValue, widthValue;
            rightValue = right(segment);
            if (rightValue instanceof Interval) {
              throw new Error("Over-constrained by " + widthName);
            } else {
              widthValue = width(segment).valueOf();
              return [rightValue, widthValue];
            }
          };
        } else {
          return function(segment) {
            var widthValue;
            widthValue = width(segment).valueOf();
            return [-widthValue / 2, widthValue];
          };
        }
      } else {
        if (right) {
          return function(segment) {
            var rightValue;
            rightValue = right(segment);
            if (rightValue instanceof Interval) {
              return [rightValue.start, rightValue.end - rightValue.start];
            } else {
              return [0, rightValue];
            }
          };
        } else {
          throw new Error("Under-constrained, must have ether " + leftName + ", " + widthName + " or " + rightName);
        }
      }
    })();
    if (flip) {
      return function(segment) {
        var pos;
        pos = fn(segment);
        pos[0] = -pos[0] - pos[1];
        return pos;
      };
    } else {
      return fn;
    }
  };

  checkStage = function(stage, requiredType) {
    if (stage.type !== requiredType) {
      throw new Error("Must have a " + requiredType + " stage (is " + stage.type + ")");
    }
  };

  facet.transform = {
    point: {
      point: function(args) {
        var fx, fy;
        if (args == null) {
          args = {};
        }
        fx = pointOnPoint(args, 'left', 'right');
        fy = pointOnPoint(args, 'top', 'bottom');
        return function(segment) {
          var stage;
          stage = segment.getStage();
          checkStage(stage, 'point');
          return {
            x: fx(segment, stage.width),
            y: fy(segment, stage.height),
            stage: {
              type: 'point'
            }
          };
        };
      },
      line: function(args) {
        var fx;
        if (args == null) {
          args = {};
        }
        fx = lineOnPoint(args, 'left', 'width', 'right');
        return function(segment) {
          var stage, w, x, _ref;
          stage = segment.getStage();
          checkStage(stage, 'point');
          _ref = fx(segment, stage.width), x = _ref[0], w = _ref[1];
          return {
            x: x,
            y: 0,
            stage: {
              type: 'line',
              length: w
            }
          };
        };
      },
      rectangle: function(args) {
        var fx, fy;
        if (args == null) {
          args = {};
        }
        fx = lineOnPoint(args, 'left', 'width', 'right');
        fy = lineOnPoint(args, 'top', 'height', 'bottom');
        return function(segment) {
          var h, stage, w, x, y, _ref, _ref1;
          stage = segment.getStage();
          checkStage(stage, 'point');
          _ref = fx(segment, stage.width), x = _ref[0], w = _ref[1];
          _ref1 = fy(segment, stage.height), y = _ref1[0], h = _ref1[1];
          return {
            x: x,
            y: y,
            stage: {
              type: 'rectangle',
              width: w,
              height: h
            }
          };
        };
      }
    },
    line: {
      point: function() {
        throw "not implemented yet";
      },
      line: function() {
        throw "not implemented yet";
      },
      rectangle: function() {
        throw "not implemented yet";
      }
    },
    rectangle: {
      point: function(args) {
        var fx, fy;
        if (args == null) {
          args = {};
        }
        fx = pointOnLine(args, 'left', 'right');
        fy = pointOnLine(args, 'top', 'bottom');
        return function(segment) {
          var stage;
          stage = segment.getStage();
          checkStage(stage, 'rectangle');
          return {
            x: fx(segment, stage.width),
            y: fy(segment, stage.height),
            stage: {
              type: 'point'
            }
          };
        };
      },
      line: function() {
        throw "not implemented yet";
      },
      rectangle: function(args) {
        var fx, fy;
        if (args == null) {
          args = {};
        }
        fx = lineOnLine(args, 'left', 'width', 'right');
        fy = lineOnLine(args, 'top', 'height', 'bottom');
        return function(segment) {
          var h, stage, w, x, y, _ref, _ref1;
          stage = segment.getStage();
          checkStage(stage, 'rectangle');
          _ref = fx(segment, stage.width), x = _ref[0], w = _ref[1];
          _ref1 = fy(segment, stage.height), y = _ref1[0], h = _ref1[1];
          return {
            x: x,
            y: y,
            stage: {
              type: 'rectangle',
              width: w,
              height: h
            }
          };
        };
      }
    },
    polygon: {
      point: function() {
        throw "not implemented yet";
      },
      polygon: function() {
        throw "not implemented yet";
      }
    }
  };

  facet.plot = {
    box: function(_arg) {
      var fill, opacity, stroke;
      stroke = _arg.stroke, fill = _arg.fill, opacity = _arg.opacity;
      stroke = wrapLiteral(stroke);
      fill = wrapLiteral(fill);
      opacity = wrapLiteral(opacity);
      return function(segment) {
        var stage;
        stage = segment.getStage();
        if (stage.type !== 'rectangle') {
          throw new Error("Box must have a rectangle stage (is " + stage.type + ")");
        }
        stage.node.append('rect').datum(segment).attr('width', stage.width).attr('height', stage.height).style('fill', fill).style('stroke', stroke).style('opacity', opacity);
      };
    },
    label: function(_arg) {
      var anchor, angle, baseline, color, size, text;
      color = _arg.color, text = _arg.text, size = _arg.size, anchor = _arg.anchor, baseline = _arg.baseline, angle = _arg.angle;
      color = wrapLiteral(color);
      text = wrapLiteral(text != null ? text : 'Label');
      size = wrapLiteral(size);
      anchor = wrapLiteral(anchor);
      baseline = wrapLiteral(baseline);
      angle = wrapLiteral(angle);
      return function(segment) {
        var myNode, stage;
        stage = segment.getStage();
        if (stage.type !== 'point') {
          throw new Error("Label must have a point stage (is " + stage.type + ")");
        }
        myNode = stage.node.append('text').datum(segment);
        if (angle) {
          myNode.attr('transform', "rotate(" + (-angle(segment)) + ")");
        }
        if (baseline) {
          myNode.attr('dy', function(segment) {
            var baselineValue;
            baselineValue = baseline(segment);
            if (baselineValue === 'top') {
              return '.71em';
            } else if (baselineValue === 'center') {
              return '.35em';
            } else {
              return null;
            }
          });
        }
        myNode.style('font-size', size).style('fill', color).style('text-anchor', anchor).text(text);
      };
    },
    circle: function(_arg) {
      var fill, radius, stroke;
      radius = _arg.radius, stroke = _arg.stroke, fill = _arg.fill;
      radius = wrapLiteral(radius != null ? radius : 5);
      stroke = wrapLiteral(stroke);
      fill = wrapLiteral(fill);
      return function(segment) {
        var stage;
        stage = segment.getStage();
        if (stage.type !== 'point') {
          throw new Error("Circle must have a point stage (is " + stage.type + ")");
        }
        stage.node.append('circle').datum(segment).attr('r', radius).style('fill', fill).style('stroke', stroke);
      };
    }
  };

  FacetJob = (function() {

    FacetJob.name = 'FacetJob';

    function FacetJob(selector, width, height, driver) {
      this.selector = selector;
      this.width = width;
      this.height = height;
      this.driver = driver;
      this.ops = [];
      this.knownProps = {};
      this.hasSplit = false;
      this.hasTransformed = false;
    }

    FacetJob.prototype.split = function(propName, split) {
      split = _.clone(split);
      split.operation = 'split';
      split.prop = propName;
      this.ops.push(split);
      this.hasSplit = true;
      this.hasTransformed = false;
      this.knownProps[propName] = true;
      return this;
    };

    FacetJob.prototype.layout = function(layout) {
      if (!this.hasSplit) {
        throw new Error("Must split before calling layout");
      }
      if (this.hasTransformed) {
        throw new Error("Can not layout after a transform");
      }
      if (typeof layout !== 'function') {
        throw new TypeError("layout must be a function");
      }
      this.ops.push({
        operation: 'layout',
        layout: layout
      });
      return this;
    };

    FacetJob.prototype.apply = function(propName, apply) {
      apply = _.clone(apply);
      apply.operation = 'apply';
      apply.prop = propName;
      this.ops.push(apply);
      this.knownProps[propName] = true;
      return this;
    };

    FacetJob.prototype.scale = function(name, scale) {
      if (typeof scale !== 'function') {
        throw new TypeError("scale must be a function");
      }
      this.ops.push({
        operation: 'scale',
        name: name,
        scale: scale
      });
      return this;
    };

    FacetJob.prototype.train = function(name, param) {
      this.ops.push({
        operation: 'train',
        name: name,
        param: param
      });
      return this;
    };

    FacetJob.prototype.combine = function(_arg) {
      var combine, filter, limit, sort, _base, _ref;
      _ref = _arg != null ? _arg : {}, filter = _ref.filter, sort = _ref.sort, limit = _ref.limit;
      combine = {
        operation: 'combine'
      };
      if (sort) {
        if (!this.knownProps[sort.prop]) {
          throw new Error("can not sort on unknown prop '" + sort.prop + "'");
        }
        combine.sort = sort;
        if ((_base = combine.sort).compare == null) {
          _base.compare = 'natural';
        }
      }
      if (limit != null) {
        combine.limit = limit;
      }
      this.ops.push(combine);
      return this;
    };

    FacetJob.prototype.transform = function(transform) {
      if (typeof transform !== 'function') {
        throw new TypeError("transform must be a function");
      }
      this.ops.push({
        operation: 'transform',
        transform: transform
      });
      this.hasTransformed = true;
      return this;
    };

    FacetJob.prototype.untransform = function() {
      this.ops.push({
        operation: 'untransform'
      });
      return this;
    };

    FacetJob.prototype.plot = function(plot) {
      if (typeof plot !== 'function') {
        throw new TypeError("plot must be a function");
      }
      this.ops.push({
        operation: 'plot',
        plot: plot
      });
      return this;
    };

    FacetJob.prototype.getQuery = function() {
      return this.ops.filter(function(_arg) {
        var operation;
        operation = _arg.operation;
        return operation === 'split' || operation === 'apply' || operation === 'combine';
      });
    };

    FacetJob.prototype.render = function() {
      var height, operations, parent, svg, width;
      parent = d3.select(this.selector);
      width = this.width;
      height = this.height;
      if (parent.empty()) {
        throw new Error("could not find the provided selector");
      }
      svg = parent.append('svg').attr({
        "class": 'facet loading',
        width: width,
        height: height
      });
      operations = this.ops;
      this.driver(this.getQuery(), function(err, res) {
        var cmd, hops, i, layout, name, param, parentSegment, plot, pseudoStage, pseudoStages, scale, segment, segmentGroup, segmentGroups, sourceSegment, transform, unifiedSegments, _i, _j, _k, _l, _len, _len1, _len10, _len2, _len3, _len4, _len5, _len6, _len7, _len8, _len9, _m, _n, _o, _p, _q, _r, _s;
        svg.classed('loading', false);
        if (err) {
          svg.classed('error', true);
          alert("An error has occurred: " + (typeof err === 'string' ? err : err.message));
          return;
        }
        segmentGroups = [
          [
            new Segment({
              parent: null,
              stage: {
                node: svg,
                type: 'rectangle',
                width: width,
                height: height
              },
              prop: res.prop,
              splits: res.splits
            })
          ]
        ];
        for (_i = 0, _len = operations.length; _i < _len; _i++) {
          cmd = operations[_i];
          switch (cmd.operation) {
            case 'split':
              segmentGroups = flatten(segmentGroups).map(function(segment) {
                return segment.splits = segment.splits.map(function(_arg) {
                  var key, prop, splits, stage, value;
                  prop = _arg.prop, splits = _arg.splits;
                  stage = _.clone(segment.getStage());
                  stage.node = stage.node.append('g');
                  for (key in prop) {
                    value = prop[key];
                    if (Array.isArray(value)) {
                      prop[key] = Interval.fromArray(value);
                    }
                  }
                  return new Segment({
                    parent: segment,
                    stage: stage,
                    prop: prop,
                    splits: splits
                  });
                });
              });
              break;
            case 'apply':
            case 'combine':
              null;

              break;
            case 'scale':
              name = cmd.name, scale = cmd.scale;
              for (_j = 0, _len1 = segmentGroups.length; _j < _len1; _j++) {
                segmentGroup = segmentGroups[_j];
                for (_k = 0, _len2 = segmentGroup.length; _k < _len2; _k++) {
                  segment = segmentGroup[_k];
                  segment.scale[name] = {
                    train: scale
                  };
                }
              }
              break;
            case 'train':
              name = cmd.name, param = cmd.param;
              sourceSegment = segmentGroups[0][0];
              hops = 0;
              while (true) {
                if (sourceSegment.scale[name]) {
                  break;
                }
                sourceSegment = sourceSegment.parent;
                hops++;
                if (!sourceSegment) {
                  throw new Error("can not find scale '" + name + "'");
                }
              }
              unifiedSegments = [sourceSegment];
              while (hops > 0) {
                unifiedSegments = flatten(unifiedSegments.map(function(s) {
                  return s.splits;
                }));
                hops--;
              }
              if (!sourceSegment.scale[name].train) {
                throw new Error("Scale '" + name + "' already trained");
              }
              sourceSegment.scale[name] = sourceSegment.scale[name].train(unifiedSegments, param);
              break;
            case 'layout':
              layout = cmd.layout;
              for (_l = 0, _len3 = segmentGroups.length; _l < _len3; _l++) {
                segmentGroup = segmentGroups[_l];
                parentSegment = segmentGroup[0].parent;
                if (!parentSegment) {
                  throw new Error("must split before calling layout");
                }
                pseudoStages = layout(parentSegment, segmentGroup);
                for (i = _m = 0, _len4 = segmentGroup.length; _m < _len4; i = ++_m) {
                  segment = segmentGroup[i];
                  pseudoStage = pseudoStages[i];
                  pseudoStage.stage.node = segment.getStage().node.attr('transform', "translate(" + pseudoStage.x + "," + pseudoStage.y + ")");
                  segment.setStage(pseudoStage.stage);
                }
              }
              break;
            case 'transform':
              transform = cmd.transform;
              for (_n = 0, _len5 = segmentGroups.length; _n < _len5; _n++) {
                segmentGroup = segmentGroups[_n];
                for (_o = 0, _len6 = segmentGroup.length; _o < _len6; _o++) {
                  segment = segmentGroup[_o];
                  pseudoStage = transform(segment);
                  pseudoStage.stage.node = segment.getStage().node.append('g').attr('transform', "translate(" + pseudoStage.x + "," + pseudoStage.y + ")");
                  segment.pushStage(pseudoStage.stage);
                }
              }
              break;
            case 'untransform':
              for (_p = 0, _len7 = segmentGroups.length; _p < _len7; _p++) {
                segmentGroup = segmentGroups[_p];
                for (_q = 0, _len8 = segmentGroup.length; _q < _len8; _q++) {
                  segment = segmentGroup[_q];
                  segment.popStage();
                }
              }
              break;
            case 'plot':
              plot = cmd.plot;
              for (_r = 0, _len9 = segmentGroups.length; _r < _len9; _r++) {
                segmentGroup = segmentGroups[_r];
                for (_s = 0, _len10 = segmentGroup.length; _s < _len10; _s++) {
                  segment = segmentGroup[_s];
                  plot(segment);
                }
              }
              break;
            default:
              throw new Error("Unknown operation '" + cmd.operation + "'");
          }
        }
      });
      return this;
    };

    return FacetJob;

  })();

  facet.define = function(selector, width, height, driver) {
    if (!(width && height)) {
      throw new Error("bad size: " + width + " x " + height);
    }
    return new FacetJob(selector, width, height, driver);
  };

  facet.ajaxPoster = function(_arg) {
    var context, prety, url;
    url = _arg.url, context = _arg.context, prety = _arg.prety;
    return function(query, callback) {
      return $.ajax({
        url: url,
        type: 'POST',
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
          context: context,
          query: query
        }, null, prety ? 2 : null),
        success: function(res) {
          callback(null, res);
        },
        error: function(xhr) {
          var err, text;
          text = xhr.responseText;
          try {
            err = JSON.parse(text);
          } catch (e) {
            err = {
              message: text
            };
          }
          callback(err, null);
        }
      });
    };
  };

  facet.verboseDriver = function(driver) {
    return function(query, callback) {
      console.log('Query:', query);
      driver(query, function(err, res) {
        console.log('Result:', res);
        callback(err, res);
      });
    };
  };

}).call(this);
