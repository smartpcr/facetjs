{ expect } = require("chai")

{ WallTime } = require('chronology')
if not WallTime.rules
  tzData = require("chronology/lib/walltime/walltime-data.js")
  WallTime.init(tzData.rules, tzData.zones)

{ druidRequesterFactory } = require('facetjs-druid-requester')

facet = require('../../build/facet')
{ Expression, Dataset, TimeRange, $, basicDispatcherFactory } = facet

info = require('../info')

druidRequester = druidRequesterFactory({
  host: info.druidHost
})

describe "DruidDataset", ->
  @timeout(10000);

  describe "defined attributes in datasource", ->
    basicDispatcher = basicDispatcherFactory({
      datasets: {
        wiki: Dataset.fromJS({
          source: 'druid',
          dataSource: 'wikipedia_editstream',
          timeAttribute: 'time',
          context: null
          attributes: {
            time: {type: 'TIME'}
            language: {type: 'STRING'}
            page: {type: 'STRING'}
            added: {type: 'NUMBER'}
            count: {type: 'NUMBER'}
          }
          filter: $('time').in(TimeRange.fromJS({
            start: new Date("2013-02-26T00:00:00Z")
            end: new Date("2013-02-27T00:00:00Z")
          }))
          requester: druidRequester
        })
      }
    })

    it "works timePart case", (testComplete) ->
      ex = $()
        .def("wiki", $('wiki').filter($("language").is('en')))
        .apply('HoursOfDay',
          $("wiki").split("$time.timePart(HOUR_OF_DAY, 'Etc/UTC')", 'HourOfDay')
            .apply('TotalAdded', '$wiki.sum($added)')
            .sort('$TotalAdded', 'descending')
            .limit(3)
        )

      # console.log("ex.simulateQueryPlan(context)", JSON.stringify(ex.simulateQueryPlan(context), null, 2));

      basicDispatcher(ex).then((result) ->
        expect(result.toJS()).to.deep.equal([
         {
           "HoursOfDay": [
             {
               "HourOfDay": 17
               "TotalAdded": 2780987
             }
             {
               "HourOfDay": 18
               "TotalAdded": 2398056
             }
             {
               "HourOfDay": 21
               "TotalAdded": 2357434
             }
           ]
         }
        ])
        testComplete()
      ).done()

    it "works in advanced case", (testComplete) ->
      ex = $()
        .def("wiki", $('wiki').filter($("language").is('en')))
        .apply('Count', '$wiki.sum($count)')
        .apply('TotalAdded', '$wiki.sum($added)')
        .apply('Pages',
          $("wiki").split("$page", 'Page')
            .apply('Count', '$wiki.sum($count)')
            .sort('$Count', 'descending')
            .limit(2)
            .apply('Time',
              $("wiki").split($("time").timeBucket('PT1H', 'Etc/UTC'), 'Timestamp')
                .apply('TotalAdded', '$wiki.sum($added)')
                .sort('$TotalAdded', 'descending')
                .limit(3)
            )
        )
        .apply('PagesHaving',
          $("wiki").split("$page", 'Page')
            .apply('Count', '$wiki.sum($count)')
            .sort('$Count', 'descending')
            .filter($('Count').lessThan(300))
            .limit(5)
        )

      basicDispatcher(ex).then((result) ->
        expect(result.toJS()).to.deep.equal([
          {
            "Count": 334129
            "Pages": [
              {
                "Count": 626
                "Page": "User:Addbot/log/wikidata"
                "Time": [
                  {
                    "Timestamp": {
                      "end": new Date("2013-02-26T20:00:00.000Z")
                      "start": new Date("2013-02-26T19:00:00.000Z")
                      "type": "TIME_RANGE"
                    }
                    "TotalAdded": 180454
                  }
                  {
                    "Timestamp": {
                      "end": new Date("2013-02-26T13:00:00.000Z")
                      "start": new Date("2013-02-26T12:00:00.000Z")
                      "type": "TIME_RANGE"
                    }
                    "TotalAdded": 178939
                  }
                  {
                    "Timestamp": {
                      "end": new Date("2013-02-26T01:00:00.000Z")
                      "start": new Date("2013-02-26T00:00:00.000Z")
                      "type": "TIME_RANGE"
                    }
                    "TotalAdded": 159582
                  }
                ]
              }
              {
                "Count": 329
                "Page": "User:Legobot/Wikidata/General"
                "Time": [
                  {
                    "Timestamp": {
                      "end": new Date("2013-02-26T16:00:00.000Z")
                      "start": new Date("2013-02-26T15:00:00.000Z")
                      "type": "TIME_RANGE"
                    }
                    "TotalAdded": 7609
                  }
                  {
                    "Timestamp": {
                      "end": new Date("2013-02-26T22:00:00.000Z")
                      "start": new Date("2013-02-26T21:00:00.000Z")
                      "type": "TIME_RANGE"
                    }
                    "TotalAdded": 6919
                  }
                  {
                    "Timestamp": {
                      "end": new Date("2013-02-26T17:00:00.000Z")
                      "start": new Date("2013-02-26T16:00:00.000Z")
                      "type": "TIME_RANGE"
                    }
                    "TotalAdded": 5717
                  }
                ]
              }
            ],
            "PagesHaving": [
              {
                "Count": 252
                "Page": "User:Cyde/List_of_candidates_for_speedy_deletion/Subpage"
              }
              {
                "Count": 242
                "Page": "Wikipedia:Administrator_intervention_against_vandalism"
              }
              {
                "Count": 133
                "Page": "Wikipedia:Reference_desk/Science"
              }
            ]
            "TotalAdded": 41412583
          }
        ])
        testComplete()
      ).done()


  describe "introspection", ->
    basicDispatcher = basicDispatcherFactory({
      datasets: {
        wiki: Dataset.fromJS({
          source: 'druid',
          dataSource: 'wikipedia_editstream',
          timeAttribute: 'time',
          context: null
          filter: $('time').in(TimeRange.fromJS({
            start: new Date("2013-02-26T00:00:00Z")
            end: new Date("2013-02-27T00:00:00Z")
          }))
          requester: druidRequester
        })
      }
    })

    it "works with introspection", (testComplete) ->
      ex = $()
        .def("wiki", $('wiki').filter($("language").is('en')))
        .apply('Count', '$wiki.sum($count)')
        .apply('TotalAdded', '$wiki.sum($added)')
        .apply('Time',
          $("wiki").split($("time").timeBucket('PT1H', 'Etc/UTC'), 'Timestamp')
            .apply('TotalAdded', '$wiki.sum($added)')
            .sort('$Timestamp', 'ascending')
            .limit(3)
            .apply('Pages',
              $("wiki").split("$page", 'Page')
                .apply('Count', '$wiki.sum($count)')
                .sort('$Count', 'descending')
                .limit(2)
            )
        )

      basicDispatcher(ex).then((result) ->
        expect(result.toJS()).to.deep.equal([
          {
            "Count": 334129
            "Time": [
              {
                "Pages": [
                  {
                    "Count": 130
                    "Page": "User:Addbot/log/wikidata"
                  }
                  {
                    "Count": 31
                    "Page": "Wikipedia:Categories_for_discussion/Speedy"
                  }
                ]
                "Timestamp": {
                  "end": new Date("2013-02-26T01:00:00.000Z")
                  "start": new Date("2013-02-26T00:00:00.000Z")
                  "type": "TIME_RANGE"
                }
                "TotalAdded": 2149342
              }
              {
                "Pages": [
                  {
                    "Count": 121
                    "Page": "User:Addbot/log/wikidata"
                  }
                  {
                    "Count": 34
                    "Page": "Ahmed_Elkady"
                  }
                ]
                "Timestamp": {
                  "end": new Date("2013-02-26T02:00:00.000Z")
                  "start": new Date("2013-02-26T01:00:00.000Z")
                  "type": "TIME_RANGE"
                }
                "TotalAdded": 1717907
              }
              {
                "Pages": [
                  {
                    "Count": 22
                    "Page": "User:Libsbml/sandbox"
                  }
                  {
                    "Count": 20
                    "Page": "The_Biggest_Loser:_Challenge_America"
                  }
                ]
                "Timestamp": {
                  "end": new Date("2013-02-26T03:00:00.000Z")
                  "start": new Date("2013-02-26T02:00:00.000Z")
                  "type": "TIME_RANGE"
                }
                "TotalAdded": 1258761
              }
            ]
            "TotalAdded": 41412583
          }
        ])
        testComplete()
      ).done()

    it "works with no attributes in time split dataset", ->
      ex = $()
        .apply('ByHour',
          $('diamonds').split($("time").timeBucket('PT1H', 'Etc/UTC'), 'TimeByHour')
            .sort('$TimeByHour', 'ascending')
            .limit(3)
            .apply('Users',
              $('diamonds').split('$color', 'Color')
                .apply('Count', $('diamonds').count())
                .sort('$Count', 'descending')
                .limit(2)
          )
        )

      basicDispatcher(ex).then((result) ->
        expect(result.toJS()).to.deep.equal([

        ])
        testComplete()
      ).done()
