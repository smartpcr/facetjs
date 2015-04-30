{ expect } = require("chai")

facet = require('../../build/facet')
{ Expression, Dataset, $ } = facet

describe "reference check", ->

  context = {
    diamonds: Dataset.fromJS([
      { color: 'A', cut: 'great', carat: 1.1, price: 300 }
    ])
  }

  describe "errors", ->
    it "fails to resolve a variable that does not exist", ->
      ex = $()
        .def('num', 5)
        .apply('subData',
          $()
            .apply('x', '$num + 1')
            .apply('y', '$foo * 2')
        )

      expect(->
        ex.referenceCheck({})
      ).to.throw('could not resolve $foo')

    it "fails to resolve a variable that does not exist (in scope)", ->
      ex = $()
        .def('num', 5)
        .apply('subData',
          $()
            .apply('x', '$num + 1')
            .apply('y', '$^x * 2')
        )

      expect(->
        ex.referenceCheck({})
      ).to.throw('could not resolve $^x')

    it "fails to when a variable goes too deep", ->
      ex = $()
        .def('num', 5)
        .apply('subData',
          $()
            .apply('x', '$num + 1')
            .apply('y', '$^^^x * 2')
        )

      expect(->
        ex.referenceCheck({ x: 5 })
      ).to.throw('went too deep on $^^^x')

    it "fails when discovering that the types mismatch", ->
      ex = $()
        .def('str', 'Hello')
        .apply('subData',
          $()
            .apply('x', '$str + 1')
        )

      expect(->
        ex.referenceCheck({ str: 'Hello World' })
      ).to.throw('add must have an operand of type NUMBER at position 0')

    it "fails when discovering that the types mismatch via label", ->
      ex = $()
        .def("diamonds", $("diamonds").filter($('color').is('D')))
        .apply('Cuts',
          $("diamonds").group("$cut").label('Cut')
            .apply('TotalPrice', '$Cut * 10')
        )

      expect(->
        ex.referenceCheck(context)
      ).to.throw('multiply must have an operand of type NUMBER at position 0')


  describe "resolves", ->
    it "works in a basic case", ->
      ex = $()
        .def('num', 5)
        .apply('subData',
          $()
            .apply('x', '$num + 1')
            .apply('y', '$x * 2')
        )

      expect(ex.referenceCheck({}).toJS()).to.deep.equal(
        $()
          .def('num', 5)
          .apply('subData',
            $()
              .apply('x', '$^num:NUMBER + 1')
              .apply('y', '$x:NUMBER * 2')
          )
          .toJS()
      )

    it "works from context", ->
      ex = $('diamonds')
        .def('priceOver2', '$price / 2')

      expect(ex.referenceCheck(context).toJS()).to.deep.equal(
        $('diamonds:DATASET')
          .def('priceOver2', '$price:NUMBER / 2')
          .toJS()
      )

    it "a split", ->
      ex = $()
        .def("diamonds", $("diamonds").filter($('color').is('D')))
        .apply('Count', '$diamonds.count()')
        .apply('TotalPrice', '$diamonds.sum($price)')
        .apply('Cuts',
          $("diamonds").group("$cut").label('Cut')
            .def('diamonds', $('diamonds').filter($('cut').is('$^Cut')))
            .apply('Count', '$diamonds.count()')
            .apply('TotalPrice', '$diamonds.sum($price)')
            .apply('AvgPrice', '$TotalPrice / $Count')
            .sort('$AvgPrice', 'descending')
            .limit(10)
        )

      expect(ex.referenceCheck(context).toJS()).to.deep.equal(
        $()
          .def("diamonds", $("^diamonds:DATASET").filter($('color:STRING').is('D')))
          .apply('Count', '$diamonds:DATASET.count()')
          .apply('TotalPrice', '$diamonds:DATASET.sum($price:NUMBER)')
          .apply('Cuts',
            $("diamonds:DATASET").group("$cut:STRING").label('Cut')
              .def('diamonds', $('^diamonds:DATASET').filter($('cut:STRING').is('$^Cut:STRING')))
              .apply('Count', '$diamonds:DATASET.count()')
              .apply('TotalPrice', '$diamonds:DATASET.sum($price:NUMBER)')
              .apply('AvgPrice', '$TotalPrice:NUMBER / $Count:NUMBER')
              .sort('$AvgPrice:NUMBER', 'descending')
              .limit(10)
          )
          .toJS()
      )

    it "a base split", ->
      ex = $("diamonds").group("$cut").label('Cut')
        .def('diamonds', $('diamonds').filter($('cut').is('$^Cut')))
        .apply('Count', '$diamonds.count()')
        .apply('TotalPrice', '$diamonds.sum($price)')

      expect(ex.referenceCheck(context).toJS()).to.deep.equal(
        $("diamonds:DATASET").group("$cut:STRING").label('Cut')
          .def('diamonds', $('^diamonds:DATASET').filter($('cut:STRING').is('$^Cut:STRING')))
          .apply('Count', '$diamonds:DATASET.count()')
          .apply('TotalPrice', '$diamonds:DATASET.sum($price:NUMBER)')
          .toJS()
      )

    it "a base split + filter", ->
      ex = $("diamonds").filter($('color').is('D')).group("$cut").label('Cut')
        .def('diamonds', $('diamonds').filter($('color').is('D')).filter($('cut').is('$^Cut')))
        .apply('Count', '$diamonds.count()')
        .apply('TotalPrice', '$diamonds.sum($price)')

      expect(ex.referenceCheck(context).toJS()).to.deep.equal(
        $("diamonds:DATASET").filter($('color:STRING').is('D')).group("$cut:STRING").label('Cut')
          .def('diamonds', $('^diamonds:DATASET').filter($('color:STRING').is('D')).filter($('cut:STRING').is('$^Cut:STRING')))
          .apply('Count', '$diamonds:DATASET.count()')
          .apply('TotalPrice', '$diamonds:DATASET.sum($price:NUMBER)')
          .toJS()
      )

    it "a base split + filter (using split)", ->
      ex = $("diamonds").filter($('color').is('D')).split("$cut", 'Cut', 'diamonds')
        .apply('Count', '$diamonds.count()')
        .apply('TotalPrice', '$diamonds.sum($price)')

      expect(ex.referenceCheck(context).toJS()).to.deep.equal(
        $("diamonds:DATASET").filter($('color:STRING').is('D')).group("$cut:STRING").label('Cut')
          .def('diamonds', $('^diamonds:DATASET').filter($('color:STRING').is('D')).filter($('cut:STRING').is('$^Cut:STRING')))
          .apply('Count', '$diamonds:DATASET.count()')
          .apply('TotalPrice', '$diamonds:DATASET.sum($price:NUMBER)')
          .toJS()
      )

    it "two splits", ->
      ex = $()
        .def("diamonds", $('diamonds').filter($("color").is('D')))
        .apply('Count', $('diamonds').count())
        .apply('TotalPrice', $('diamonds').sum('$price'))
        .apply('Cuts',
          $("diamonds").group("$cut").label('Cut')
            .def('diamonds', $('diamonds').filter($('cut').is('$^Cut')))
            .apply('Count', $('diamonds').count())
            .sort('$Count', 'descending')
            .limit(2)
            .apply('Carats',
              $("diamonds").group($("carat").numberBucket(0.25)).label('Carat')
                .def('diamonds', $('diamonds').filter($("carat").numberBucket(0.25).is('$^Carat')))
                .apply('Count', $('diamonds').count())
                .sort('$Count', 'descending')
                .limit(3)
            )
        )

      expect(ex.referenceCheck(context).toJS()).to.deep.equal(
        $()
          .def("diamonds", $('^diamonds:DATASET').filter($("color:STRING").is('D')))
          .apply('Count', $('diamonds:DATASET').count())
          .apply('TotalPrice', $('diamonds:DATASET').sum('$price:NUMBER'))
          .apply('Cuts',
            $("diamonds:DATASET").group("$cut:STRING").label('Cut')
              .def('diamonds', $('^diamonds:DATASET').filter($('cut:STRING').is('$^Cut:STRING')))
              .apply('Count', $('diamonds:DATASET').count())
              .sort('$Count:NUMBER', 'descending')
              .limit(2)
              .apply('Carats',
                $("diamonds:DATASET").group($("carat:NUMBER").numberBucket(0.25)).label('Carat')
                  .def('diamonds', $('^diamonds:DATASET').filter($("carat:NUMBER").numberBucket(0.25).is('$^Carat:NUMBER_RANGE')))
                  .apply('Count', $('diamonds:DATASET').count())
                  .sort('$Count:NUMBER', 'descending')
                  .limit(3)
              )
          )
          .toJS()
      )
