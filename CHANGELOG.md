# Change Log

## 0.14.6

* added ability for distributively transforming aggregates: $data.sum($x + $y) => $data.sum($x) + $data.sum($y)

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
