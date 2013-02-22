// Generated by CoffeeScript 1.3.1
(function() {
  var andFilters, async, condenseQuery, condensedQueryToSQL, flatten, makeFilter, sql, timeBucketing,
    __slice = [].slice;

  async = typeof window !== 'undefined' ? window.async : require('async');

  flatten = function(ar) {
    return Array.prototype.concat.apply([], ar);
  };

  condenseQuery = function(query) {
    var cmd, condensed, curQuery, _i, _len;
    curQuery = {
      split: null,
      applies: [],
      combine: null
    };
    condensed = [];
    for (_i = 0, _len = query.length; _i < _len; _i++) {
      cmd = query[_i];
      switch (cmd.operation) {
        case 'split':
          condensed.push(curQuery);
          curQuery = {
            split: cmd,
            applies: [],
            combine: null
          };
          break;
        case 'apply':
          curQuery.applies.push(cmd);
          break;
        case 'combine':
          if (curQuery.combine) {
            throw new Error("Can not have more than one combine");
          }
          curQuery.combine = cmd;
          break;
        default:
          throw new Error("Unknown operation '" + cmd.operation + "'");
      }
    }
    condensed.push(curQuery);
    return condensed;
  };

  makeFilter = function(attribute, value) {
    return "`" + attribute + "`=\"" + value + "\"";
  };

  andFilters = function() {
    var filters;
    filters = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    filters = filters.filter(function(filter) {
      return filter != null;
    });
    switch (filters.length) {
      case 0:
        return null;
      case 1:
        return filters[0];
      default:
        return filters.join(' AND ');
    }
  };

  timeBucketing = {
    second: {
      select: '%Y-%m-%dT%H:%i:%SZ',
      group: '%Y-%m-%dT%H:%i:%SZ'
    },
    minute: {
      select: '%Y-%m-%dT%H:%i:00Z',
      group: '%Y-%m-%dT%H:%i'
    },
    hour: {
      select: '%Y-%m-%dT%H:00:00Z',
      group: '%Y-%m-%dT%H'
    },
    day: {
      select: '%Y-%m-%dT00:00:00Z',
      group: '%Y-%m-%d'
    },
    month: {
      select: '%Y-%m-00T00:00:00Z',
      group: '%Y-%m'
    },
    year: {
      select: '%Y-00-00T00:00:00Z',
      group: '%Y'
    }
  };

  condensedQueryToSQL = function(_arg, callback) {
    var apply, combine, condensedQuery, filterPart, filters, findApply, findCountApply, groupByPart, limitPart, orderByPart, requester, selectParts, sort, split, sqlQuery, table, _i, _len, _ref, _ref1;
    requester = _arg.requester, table = _arg.table, filters = _arg.filters, condensedQuery = _arg.condensedQuery;
    findApply = function(applies, propName) {
      var apply, _i, _len;
      for (_i = 0, _len = applies.length; _i < _len; _i++) {
        apply = applies[_i];
        if (apply.prop === propName) {
          return apply;
        }
      }
    };
    findCountApply = function(applies) {
      var apply, _i, _len;
      for (_i = 0, _len = applies.length; _i < _len; _i++) {
        apply = applies[_i];
        if (apply.aggregate === 'count') {
          return apply;
        }
      }
    };
    if (condensedQuery.applies.length === 0) {
      callback(null, [
        {
          prop: {}
        }
      ]);
      return;
    }
    selectParts = [];
    groupByPart = null;
    split = condensedQuery.split;
    if (split) {
      groupByPart = 'GROUP BY ';
      switch (split.bucket) {
        case 'identity':
          selectParts.push("`" + split.attribute + "` AS \"" + split.prop + "\"");
          groupByPart += "`" + split.attribute + "`";
          break;
        case 'continuous':
          callback("not implemented yet");
          return;
        case 'time':
          callback("not implemented yet");
          return;
      }
    }
    _ref = condensedQuery.applies;
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      apply = _ref[_i];
      switch (apply.aggregate) {
        case 'count':
          selectParts.push("COUNT(*) AS \"" + apply.prop + "\"");
          break;
        case 'sum':
          selectParts.push("SUM(`" + apply.attribute + "`) AS \"" + apply.prop + "\"");
          break;
        case 'average':
          selectParts.push("AVG(`" + apply.attribute + "`) AS \"" + apply.prop + "\"");
          break;
        case 'min':
          selectParts.push("MIN(`" + apply.attribute + "`) AS \"" + apply.prop + "\"");
          break;
        case 'max':
          selectParts.push("MAX(`" + apply.attribute + "`) AS \"" + apply.prop + "\"");
          break;
        case 'unique':
          selectParts.push("COUNT(DISTINCT `" + apply.attribute + "`) AS \"" + apply.prop + "\"");
      }
    }
    filterPart = null;
    if (filters) {
      filterPart = 'WHERE ' + filters;
    }
    orderByPart = null;
    limitPart = null;
    combine = condensedQuery.combine;
    if (combine) {
      sort = combine.sort;
      if (sort) {
        if (!sort.prop) {
          callback("must have a sort prop name");
          return;
        }
        if (!sort.direction) {
          callback("must have a sort direction");
          return;
        }
        if ((_ref1 = sort.direction) !== 'ASC' && _ref1 !== 'DESC') {
          callback("direction has to be 'ASC' or 'DESC'");
          return;
        }
        orderByPart = 'ORDER BY ';
        switch (sort.compare) {
          case 'natural':
            orderByPart += "`" + sort.prop + "` " + sort.direction;
            break;
          case 'caseInsensetive':
            callback("not implemented yet");
            return;
          default:
            callback("unsupported compare");
            return;
        }
      }
      if (combine.limit != null) {
        if (isNaN(combine.limit)) {
          callback("limit must be a number");
          return;
        }
        limitPart = "LIMIT " + combine.limit;
      }
    }
    sqlQuery = ['SELECT', selectParts.join(', '), "FROM `" + table + "`", filterPart, groupByPart, orderByPart, limitPart].filter(function(part) {
      return part != null;
    }).join(' ') + ';';
    requester(sqlQuery, function(err, ds) {
      var filterAttribute, filterValueProp, splits;
      if (err) {
        callback(err);
        return;
      }
      if (condensedQuery.split) {
        filterAttribute = condensedQuery.split.attribute;
        filterValueProp = condensedQuery.split.prop;
        splits = ds.map(function(prop) {
          return {
            prop: prop,
            _filters: andFilters(filters, makeFilter(filterAttribute, prop[filterValueProp]))
          };
        });
      } else {
        splits = ds.map(function(prop) {
          return {
            prop: prop,
            _filters: filters
          };
        });
      }
      callback(null, splits);
    });
  };

  sql = function(_arg) {
    var filters, requester, table;
    requester = _arg.requester, table = _arg.table, filters = _arg.filters;
    return function(query, callback) {
      var cmdIndex, condensedQuery, querySQL, rootSegment, segments;
      condensedQuery = condenseQuery(query);
      rootSegment = null;
      segments = [rootSegment];
      querySQL = function(condensed, done) {
        var QUERY_LIMIT, queryFns;
        QUERY_LIMIT = 10;
        queryFns = async.mapLimit(segments, QUERY_LIMIT, function(parentSegment, done) {
          return condensedQueryToSQL({
            requester: requester,
            table: table,
            filters: parentSegment ? parentSegment._filters : filters,
            condensedQuery: condensed
          }, function(err, splits) {
            if (err) {
              done(err);
              return;
            }
            if (parentSegment) {
              parentSegment.splits = splits;
              delete parentSegment._filters;
            } else {
              rootSegment = splits[0];
            }
            done(null, splits);
          });
        }, function(err, results) {
          if (err) {
            done(err);
            return;
          }
          segments = flatten(results);
          done();
        });
      };
      cmdIndex = 0;
      return async.whilst(function() {
        return cmdIndex < condensedQuery.length;
      }, function(done) {
        var condenced;
        condenced = condensedQuery[cmdIndex];
        cmdIndex++;
        querySQL(condenced, done);
      }, function(err) {
        var segment, _i, _len;
        if (err) {
          callback(err);
          return;
        }
        for (_i = 0, _len = segments.length; _i < _len; _i++) {
          segment = segments[_i];
          delete segment._filters;
        }
        callback(null, rootSegment);
      });
    };
  };

  if ((typeof facet !== "undefined" && facet !== null ? facet.driver : void 0) != null) {
    facet.driver.sql = sql;
  }

  if (typeof module !== 'undefined' && typeof exports !== 'undefined') {
    module.exports = sql;
  }

}).call(this);
