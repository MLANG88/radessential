# Third-party code in the DICOM viewer

Bundled into `assets/viewer/` by `npm run build:viewer`.

| Package | Version | Licence | Used for |
|---|---|---|---|
| [dicom-parser](https://github.com/cornerstonejs/dicomParser) | 1.8.21 | MIT | Reading DICOM files |
| [jpeg-lossless-decoder-js](https://github.com/rii-mango/JPEGLosslessDecoderJS) | 2.1.2 | MIT | JPEG Lossless (1.2.840.10008.1.2.4.57, .70) |
| [@cornerstonejs/codec-openjpeg](https://github.com/cornerstonejs/codecs) | 1.3.6 | MIT (OpenJPEG: BSD-2-Clause) | JPEG 2000 (.90, .91) |
| [@cornerstonejs/codec-charls](https://github.com/cornerstonejs/codecs) | 1.2.7 | MIT (CharLS: BSD-3-Clause) | JPEG-LS (.80, .81) |
| `src/vendor/jpeg12.js` from [@cornerstonejs/dicom-image-loader](https://github.com/cornerstonejs/cornerstone3D) | 5.14.0 | MIT; derived from Mozilla pdf.js (Apache-2.0) | 12-bit JPEG (.50/.51). Modified: level-shift fix for 12-bit samples |

JPEG baseline 8-bit uses the browser's own decoder.
