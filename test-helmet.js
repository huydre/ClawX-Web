// Test different helmet configs
const helmet = require('helmet');

console.log('Test 1: strictTransportSecurity: false');
console.log(helmet({ strictTransportSecurity: false }));

console.log('\nTest 2: strictTransportSecurity: { maxAge: 0 }');
console.log(helmet({ strictTransportSecurity: { maxAge: 0 } }));

console.log('\nTest 3: hsts: false');
console.log(helmet({ hsts: false }));
