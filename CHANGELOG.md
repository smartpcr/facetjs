# Change Log

## 0.15.7

* added attributeOverrides to remote dataset to allow the user to force certain attributes

## 0.15.6

* fixed bug in new chronology update

## 0.15.5

* updated chronology
* removed a number of unused dependencies

## 0.15.4

* changed internal facetjs code to use more ES6 features following the beta release of TypeScript 1.5

## 0.15.3

* added support for uniques

## 0.15.2

* better errors in SQL parser for the case of a multi-dimensional GROUP BY or ORDER BY

## 0.15.1

* started fSQL docs
* in ref expression renamed `generations` -> `nest`
* allow facet variables with fancy names like `${I blame your mother!}`

## 0.14.8

* average decomposition it is now possible to do: `$data.average($y)` => `$data.sum($y) / $data.count()`

## 0.14.7

* distribute over constant multiplication `$data.sum(2 * $y)` => `2 * $data.sum($y)`

## 0.14.6

* added ability for distributively transforming aggregates: `$data.sum($x + $y)` => `$data.sum($x) + $data.sum($y)`

## 0.14.5

* fixed bug where Druid queries fail if not applies are given

## 0.14.4

* added verboseRequester

## 0.14.3

* moved chronology to peer decencies

## 0.14.2

* renamed limitRequesterFactory to concurrentLimitRequesterFactory - does not warrant a minor version bump since limitRequesterFactory existed for less than 24h

## 0.14.1

* Started proper change log
* renamed retryRequester to retryRequesterFactory
* added limitRequester

## 0.13.4

* Allow export of native dataset to CSV / TSV
