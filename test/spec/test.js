(function() {
  'use strict';

  describe('Test main.js', function() {
    before(function() {
      // Stuff to do before the tests, like imports, what not
    });

    describe('#printHello', function() {
      it('always returns \'Hello World\'', function () {
        expect(printHello()).to.equal('Hello World!');
      });
    });

    after(function() {
      // Anything after the tests have finished
    });
  });
})();
