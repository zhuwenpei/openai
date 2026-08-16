const fs = require('fs');
let code = fs.readFileSync('src/utils/VideoRenderEngine.ts', 'utf8');

// The file starts at 406. Let's just take everything from 406 to the end.
// Look for the SECOND '/**\n * @license'
const licenseMarker = '/**\n * @license\n * SPDX-License-Identifier: Apache-2.0\n */';
const firstLicense = code.indexOf(licenseMarker);
const secondLicense = code.indexOf(licenseMarker, firstLicense + 1);

if (secondLicense !== -1) {
    code = code.substring(secondLicense);
    fs.writeFileSync('src/utils/VideoRenderEngine.ts', code);
    console.log("Restored base file");
}
