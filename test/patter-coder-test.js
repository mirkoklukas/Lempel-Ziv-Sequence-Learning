var expect = require('chai').expect;
var Coder = require('../lib/pattern-sequence-coder.js');

describe("Pattern coder", function () {

	var coder = new Coder({
		'alphabet': "abcdefghijklmnopqrstuvwxyz_".split(""),
		'theta': 3
	}).initializeZeros()
	var space = coder.stateSpace;


	// describe("#creating states and segments", function () {
	// 	it('...', function () {
	// 		space.addStateOver("c", [1,2,3]);
	// 		space.addStateOver("a", [4,5]);
	// 		space.addStateOver("t", [6,7]);
	// 		space.addStateOver("s", [100,101]);
			
	// 		space.createSegment([1,4,6], 100);
	// 		space.createSegment([2,4,6], 101);
			
	// 		space.theta = 3;
	// 		var transition = coder.bitwiseTransition([1,2,4,6], "s");
	// 		expect(transition).to.deep.equal([101,100])
	// 	});
	// });

	describe("#learning a sequence", function () {
		it('...', function () {
			var sequence = "the_cat_sat_on_the_mat".split("");
			sequence = sequence.map(x=>[x]);
			coder.learnSequence(sequence);
		});
	});
});