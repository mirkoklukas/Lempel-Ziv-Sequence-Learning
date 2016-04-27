var expect = require('chai').expect;
var StateSpace = require('../lib/gen-state-space.js');


describe("Generalized State Space", function () {

	var space = new StateSpace({
		'alphabet': "the_cat_sat_on_the_mat".split(""),
		'theta': 3
	})


	describe("#creating states and segments", function () {
		it('...', function () {
			space.addStateOver("c", [1,2,3]);
			space.addStateOver("a", [4,5]);
			space.addStateOver("t", [6,7]);
			space.addStateOver("s", [100,101]);
			
			space.createSegment([1,4,6], 100);
			space.createSegment([2,4,6], 101);
			
			space.theta = 3;
			var transition = space.bitwiseTransition([1,2,4,6], "s");
			expect(transition).to.deep.equal([101,100])
		});
	});
});