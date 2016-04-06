Sequence learning after Lempel and Ziv
==============================

A version of the LZ78 compression algorithm. The way it is implemented is aimed towards comparing it to Numenta's temporal pooling algorithm. 

#Example Usage
```javascript
var alphabet = ['a', 'b', 'c', 'd', 'r']

var doc = 'abracadabra';
var inputSequence = doc.split("")
var SequenceCoder = require('../lib/LZ78-sequence-coder.js');

var coder  = new SequenceCoder({
     'alphabet': alphabet,
     'backShift': 0
});

coder.learnSequence(inputSequence);
```

Console output:
```shell
info: New Lempel-Ziv Sequence coder initialized: alphabet=[a, b, c, d, r], backShift=0
info: (a back shift parameter of 0 corresponds to the regular LZ78 algorithm)
info: Learn sequence: a b r a c a d a b r a
info: Learned phrase: a
info: Learned phrase: b
info: Learned phrase: r
info: Learned phrase: ac
info: Learned phrase: ad
info: Learned phrase: ab
info: Learned phrase: ra
```


