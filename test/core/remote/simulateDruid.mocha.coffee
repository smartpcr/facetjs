{ expect } = require("chai")

{ WallTime } = require('chronology')
if not WallTime.rules
  tzData = require("chronology/lib/walltime/walltime-data.js")
  WallTime.init(tzData.rules, tzData.zones)

facet = require('../../../build/facet')
{ Expression, Dataset, TimeRange } = facet.core

context = {
  diamonds: Dataset.fromJS({
    source: 'druid',
    dataSource: 'diamonds',
    timeAttribute: 'time',
    forceInterval: true,
    approximate: true,
    context: null
    attributes: {
      time: { type: 'TIME' }
      color: { type: 'STRING' }
      cut: { type: 'STRING' }
      tags: { type: 'SET/STRING' }
      carat: { type: 'NUMBER' }
      height_bucket: { special: 'range', separator: ';', rangeSize: 0.05, digitsAfterDecimal: 2 }
      price: { type: 'NUMBER', filterable: false, splitable: false }
      tax: { type: 'NUMBER', filterable: false, splitable: false }
      unique_views: { special: 'unique', filterable: false, splitable: false }
    }
    filter: facet("time").in(TimeRange.fromJS({
      start: new Date('2015-03-12T00:00:00')
      end:   new Date('2015-03-19T00:00:00')
    }))
  })
}

describe "simulate Druid", ->
  it "works in advanced case", ->
    ex = facet()
      .def("diamonds", facet('diamonds').filter(facet("color").is('D')))
      .apply('Count', '$diamonds.count()')
      .apply('TotalPrice', '$diamonds.sum($price)')
      .apply('PriceTimes2', '$diamonds.sum($price) * 2')
      .apply('PriceAndTax', '$diamonds.sum($price) * $diamonds.sum($tax)')
      .apply('PriceGoodCut', facet('diamonds').filter(facet('cut').is('good')).sum('$price'))
      .apply('Cuts',
        facet("diamonds").split("$cut", 'Cut')
          .apply('Count', facet('diamonds').count())
          .sort('$Count', 'descending')
          .limit(2)
          .apply('Time',
            facet("diamonds").split(facet("time").timeBucket('P1D', 'America/Los_Angeles'), 'Timestamp')
              .apply('TotalPrice', facet('diamonds').sum('$price'))
              .sort('$Timestamp', 'ascending')
              #.limit(10)
              .apply('Carats',
                facet("diamonds").split(facet("carat").numberBucket(0.25), 'Carat')
                  .apply('Count', facet('diamonds').count())
                  .sort('$Count', 'descending')
                  .limit(3)
              )
          )
      )

    expect(ex.simulateQueryPlan(context)).to.deep.equal([
      {
        "aggregations": [
          {
            "name": "Count"
            "type": "count"
          }
          {
            "fieldName": "price"
            "name": "TotalPrice"
            "type": "doubleSum"
          }
          {
            "fieldName": "tax"
            "name": "_sd_0"
            "type": "doubleSum"
          }
          {
            "aggregator": {
              "fieldName": "price"
              "name": "PriceGoodCut"
              "type": "doubleSum"
            }
            "filter": {
              "dimension": "cut"
              "type": "selector"
              "value": "good"
            }
            "name": "PriceGoodCut"
            "type": "filtered"
          }
        ],
        "postAggregations": [
          {
            "fields": [
              {
                "fieldName": "TotalPrice"
                "type": "fieldAccess"
              }
              {
                "type": "constant"
                "value": 2
              }
            ]
            "fn": "*"
            "name": "PriceTimes2"
            "type": "arithmetic"
          }
          {
            "fields": [
              {
                "fieldName": "TotalPrice"
                "type": "fieldAccess"
              }
              {
                "fieldName": "_sd_0"
                "type": "fieldAccess"
              }
            ]
            "fn": "*"
            "name": "PriceAndTax"
            "type": "arithmetic"
          }
        ],
        "dataSource": "diamonds"
        "filter": {
          "dimension": "color"
          "type": "selector"
          "value": "D"
        }
        "granularity": "all"
        "intervals": ["2015-03-12/2015-03-19"]
        "queryType": "timeseries"
      }
      # -----------------
      {
        "aggregations": [
          {
            "name": "Count"
            "type": "count"
          }
        ]
        "dataSource": "diamonds"
        "dimension": {
          "dimension": "cut"
          "outputName": "Cut"
          "type": "default"
        }
        "filter": {
          "dimension": "color"
          "type": "selector"
          "value": "D"
        }
        "granularity": "all"
        "intervals": ["2015-03-12/2015-03-19"]
        "metric": "Count"
        "queryType": "topN"
        "threshold": 2
      }
      # -----------------
      {
        "aggregations": [
          {
            "fieldName": "price"
            "name": "TotalPrice"
            "type": "doubleSum"
          }
        ]
        "dataSource": "diamonds"
        "filter": {
          "fields": [
            {
              "dimension": "color"
              "type": "selector"
              "value": "D"
            }
            {
              "dimension": "cut"
              "type": "selector"
              "value": "some_cut"
            }
          ]
          "type": "and"
        }
        "granularity": {
          "period": "P1D"
          "timeZone": "America/Los_Angeles"
          "type": "period"
        }
        "intervals": ["2015-03-12/2015-03-19"]
        "queryType": "timeseries"
      }
      # -----------------
      {
        "aggregations": [
          {
            "name": "Count"
            "type": "count"
          }
        ]
        "dataSource": "diamonds"
        "dimension": {
          "dimExtractionFn": {
            "function": "function(d){d=Number(d); if(isNaN(d)) return 'null'; return Math.floor(d / 0.25) * 0.25;}"
            "type": "javascript"
          }
          "dimension": "carat"
          "outputName": "Carat"
          "type": "extraction"
        }
        "filter": {
          "fields": [
            {
              "dimension": "color"
              "type": "selector"
              "value": "D"
            }
            {
              "dimension": "cut"
              "type": "selector"
              "value": "some_cut"
            }
          ]
          "type": "and"
        }
        "granularity": "all"
        "intervals": ["2015-03-13T07/2015-03-14T07"]
        "metric": "Count"
        "queryType": "topN"
        "threshold": 3
      }
    ])

  it "works with having filter", ->
    ex = facet("diamonds").split("$cut", 'Cut')
      .apply('Count', facet('diamonds').count())
      .sort('$Count', 'descending')
      .filter(facet('Count').greaterThan(100))
      .limit(10)

    expect(ex.simulateQueryPlan(context)).to.deep.equal([
      {
        "aggregations": [
          {
            "name": "Count"
            "type": "count"
          }
        ]
        "dataSource": "diamonds"
        "dimensions": [
          {
            "dimension": "cut"
            "outputName": "Cut"
            "type": "default"
          }
        ]
        "granularity": "all"
        "having": {
          "aggregation": "Count"
          "type": "greaterThan"
          "value": 100
        }
        "intervals": [
          "2015-03-12/2015-03-19"
        ]
        "limitSpec": {
          "columns": [
            "Count"
          ]
          "limit": 10
          "type": "default"
        }
        "queryType": "groupBy"
      }
    ])

  it "works with range bucket", ->
    ex = facet()
      .apply('HeightBuckets',
        facet("diamonds").split("$height_bucket", 'HeightBucket')
          .apply('Count', facet('diamonds').count())
          .sort('$Count', 'descending')
          .limit(10)
      )
      .apply('HeightUpBuckets',
        facet("diamonds").split(facet('height_bucket').numberBucket(2, 0.5), 'HeightBucket')
          .apply('Count', facet('diamonds').count())
          .sort('$Count', 'descending')
          .limit(10)
      )

    expect(ex.simulateQueryPlan(context)).to.deep.equal([
      {
        "aggregations": [
          {
            "name": "Count"
            "type": "count"
          }
        ]
        "dataSource": "diamonds"
        "dimension": {
          "dimExtractionFn": {
            "function": "function(d) {\nvar m = d.match(/^((?:-?[1-9]\\d*|0)\\.\\d{2});((?:-?[1-9]\\d*|0)\\.\\d{2})$/);\nif(!m) return 'null';\nvar s = +m[1];\nif(!(Math.abs(+m[2] - s - 0.05) < 1e-6)) return 'null'; \nvar parts = String(Math.abs(s)).split('.');\nparts[0] = ('000000000' + parts[0]).substr(-10);\nreturn (start < 0 ?'-':'') + parts.join('.');\n}"
            "type": "javascript"
          }
          "dimension": "height_bucket"
          "outputName": "HeightBucket"
          "type": "extraction"
        }
        "granularity": "all"
        "intervals": [
          "2015-03-12/2015-03-19"
        ]
        "metric": "Count"
        "queryType": "topN"
        "threshold": 10
      }
      # ---------------------
      {
        "aggregations": [
          {
            "name": "Count"
            "type": "count"
          }
        ]
        "dataSource": "diamonds"
        "dimension": {
          "dimExtractionFn": {
            "function": "function(d) {\nvar m = d.match(/^((?:-?[1-9]\\d*|0)\\.\\d{2});((?:-?[1-9]\\d*|0)\\.\\d{2})$/);\nif(!m) return 'null';\nvar s = +m[1];\nif(!(Math.abs(+m[2] - s - 0.05) < 1e-6)) return 'null'; s=Math.floor((s - 0.5) / 2) * 2 + 0.5;\nvar parts = String(Math.abs(s)).split('.');\nparts[0] = ('000000000' + parts[0]).substr(-10);\nreturn (start < 0 ?'-':'') + parts.join('.');\n}"
            "type": "javascript"
          }
          "dimension": "height_bucket"
          "outputName": "HeightBucket"
          "type": "extraction"
        }
        "granularity": "all"
        "intervals": [
          "2015-03-12/2015-03-19"
        ]
        "metric": "Count"
        "queryType": "topN"
        "threshold": 10
      }
    ])