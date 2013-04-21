utils = require('../utils')

sqlRequester = require('../../mySqlRequester')
sqlDriver = require('../../sqlDriver')
driverCache = require('../../driverCache')

# Set up drivers
driverFns = {}

# Simple
# diamondsData = require('../../../data/diamonds.js')
# driverFns.simple = simpleDriver(diamondsData)

verbose = false

# MySQL
sqlPass = sqlRequester({
  host: 'localhost'
  database: 'facet'
  user: 'facet_user'
  password: 'HadleyWickham'
})

sqlPass = utils.wrapVerbose(sqlPass, 'MySQL') if verbose

driverFns.mySql = mySql = sqlDriver({
  requester: sqlPass
  table: 'wiki_day_agg'
})

allowQuery = true
mySqlWrap = (query, callback) ->
  if not allowQuery
    console.log '---------------'
    console.log query
    console.log '---------------'
    throw new Error("query not allowed")

  mySql(query, callback)
  return

driverFns.mySqlCached = driverCache({
  driver: mySqlWrap
})

testEquality = utils.makeEqualityTest(driverFns)

# Sanity check
exports["(sanity check) apply count"] = testEquality {
  drivers: ['mySql', 'mySqlCached']
  query: [
    { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
    { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
    { operation: 'apply', name: 'Added', aggregate: 'sum', attribute: 'added' }
  ]
}

# Top N Cache Test
exports["split page; apply deleted, count; combine descending"] = testEquality {
  drivers: ['mySql', 'mySqlCached']
  query: [
    { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
    { operation: 'split', name: 'Page', bucket: 'identity', attribute: 'namespace' }
    { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
    { operation: 'apply', name: 'Deleted', aggregate: 'sum', attribute: 'deleted' }
    { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Deleted', direction: 'ascending' }, limit: 5 }
  ]
}

exports["[cache tests on] topN"] = {
  setUp: (callback) ->
    allowQuery = false
    callback()

  tearDown: (callback) ->
    allowQuery = true
    callback()

  "split page; apply deleted; combine descending": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
      { operation: 'split', name: 'Page', bucket: 'identity', attribute: 'namespace' }
      { operation: 'apply', name: 'Deleted', aggregate: 'sum', attribute: 'deleted' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Deleted', direction: 'descending' }, limit: 5 }
    ]
  }

  "split page; apply deleted, count; combine descending": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
      { operation: 'split', name: 'Page', bucket: 'identity', attribute: 'namespace' }
      { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
      { operation: 'apply', name: 'Deleted', aggregate: 'sum', attribute: 'deleted' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Deleted', direction: 'descending' }, limit: 5 }
    ]
  }
}



# Cache Test
exports["split time; apply count; apply added"] = testEquality {
  drivers: ['mySql', 'mySqlCached']
  query: [
    { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
    { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
    { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
    { operation: 'apply', name: 'Added', aggregate: 'sum', attribute: 'added' }
    { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Time', direction: 'ascending' } }
  ]
}

exports["[cache tests on] split time; apply count; apply added"] = {
  setUp: (callback) ->
    allowQuery = false
    callback()

  tearDown: (callback) ->
    allowQuery = true
    callback()

  "split time; apply count": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
      { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
      { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Time', direction: 'ascending' } }
    ]
  }

  "split time; apply count; combine not by time": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
      { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
      { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Count', direction: 'ascending' } }
    ]
  }

  "split time; apply count; filter within another time filter": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 26, 12, 0, 0))] }
      { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
      { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Time', direction: 'ascending' } }
    ]
  }

  "split time; apply count; limit": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
      { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
      { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Time', direction: 'ascending' }, limit: 5 }
    ]
  }
}

# Cache Test 2
exports["filter; split time; apply count; apply added"] = testEquality {
  drivers: ['mySql', 'mySqlCached']
  query: [
    { operation: 'filter', type: 'and', filters: [
      { operation: 'filter', attribute: 'language', type: 'is', value: 'en' }
      { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
    ]}
    { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
    { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
    { operation: 'apply', name: 'Added', aggregate: 'sum', attribute: 'added' }
    { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Time', direction: 'ascending' } }
  ]
}

exports["[cache tests on] filter; split time; apply count"] = {
  setUp: (callback) ->
    allowQuery = false
    callback()

  tearDown: (callback) ->
    allowQuery = true
    callback()

  "filter; split time; apply count; apply added": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type: 'and', filters: [
        { operation: 'filter', attribute: 'language', type: 'is', value: 'en' }
        { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
      ]}
      { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
      { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
      { operation: 'apply', name: 'Added', aggregate: 'sum', attribute: 'added' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Time', direction: 'ascending' } }
    ]
  }

  "filter; split time; apply count; apply added; combine time descending": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type: 'and', filters: [
        { operation: 'filter', attribute: 'language', type: 'is', value: 'en' }
        { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
      ]}
      { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
      { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
      { operation: 'apply', name: 'Added', aggregate: 'sum', attribute: 'added' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Time', direction: 'descending' } }
    ]
  }
}

exports["fillTree test"] = { # TODO: Use better mechanism to test
  setUp: (callback) ->
    callback()

  tearDown: (callback) ->
    callback()

  "filter; split time; apply count; apply added": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type: 'and', filters: [
        { operation: 'filter', attribute: 'language', type: 'is', value: 'en' }
        { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
      ]}
      { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
      { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Time', direction: 'ascending' } }
    ]
  }

  "filter; split time; apply count; apply added; combine time descending": testEquality {
    drivers: ['mySql', 'mySqlCached']
    query: [
      { operation: 'filter', type: 'and', filters: [
        { operation: 'filter', attribute: 'language', type: 'is', value: 'en' }
        { operation: 'filter', type:'within', attribute:'time', range: [ new Date(Date.UTC(2013, 2-1, 26, 0, 0, 0)), new Date(Date.UTC(2013, 2-1, 27, 0, 0, 0))] }
      ]}
      { operation: 'split', name: 'Time', bucket: 'timePeriod', attribute: 'time', period: 'PT1H', timezone: 'Etc/UTC' }
      { operation: 'apply', name: 'Count', aggregate: 'sum', attribute: 'count' }
      { operation: 'apply', name: 'Added', aggregate: 'sum', attribute: 'added' }
      { operation: 'combine', combine: 'slice', sort: { compare: 'natural', prop: 'Time', direction: 'descending' } }
    ]
  }
}



