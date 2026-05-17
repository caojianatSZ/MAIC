// compile.js
const pptxgen = require('pptxgenjs');
const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = 'OpenMAIC';
pres.title = '远程教育运营平台 · 产品方案';

const theme = {
  primary: "264653",    // dark teal — titles, headers
  secondary: "2a9d8f",  // teal green — body emphasis, accents
  accent: "e9c46a",     // gold — highlights, badges
  light: "f4a261",      // warm orange — secondary accents
  bg: "FFFFFF"           // white background
};

for (let i = 1; i <= 16; i++) {
  const num = String(i).padStart(2, '0');
  const slideModule = require(`./slide-${num}.js`);
  slideModule.createSlide(pres, theme);
}

pres.writeFile({ fileName: './output/presentation.pptx' })
  .then(() => console.log('PPTX generated: ./output/presentation.pptx'))
  .catch(err => console.error('Error:', err));
