const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const pdfPath = path.join(
  __dirname,
  '../data/source/duke-2026-tysp.pdf'
);

async function inspectDukeMaps() {
  const pdfBuffer = fs.readFileSync(pdfPath);

  const parser = new PDFParse({
    data: pdfBuffer
  });

  try {
    const result = await parser.getText();
    const text = result.text;

    // Duke labels the project maps as FIGURE 4.x
    const figurePattern =
      /FIGURE\s+(4\.\d+)\s*\n([^\n]+)/gi;

    const matches = [
      ...text.matchAll(figurePattern)
    ];

    console.log(
      `Found ${matches.length} Chapter 4 figures/maps.`
    );

    console.log(
      '========================================'
    );

    for (const match of matches) {
      const figureNumber = match[1];
      const figureTitle = match[2].trim();

      // Find the closest PDF page marker before the figure.
      const beforeFigure = text.slice(
        0,
        match.index
      );

      const pageMatches = [
        ...beforeFigure.matchAll(
          /--\s*(\d+)\s+of\s+(\d+)\s*--/g
        )
      ];

      let pdfPage = null;

      if (pageMatches.length > 0) {
        pdfPage =
          parseInt(
            pageMatches[
              pageMatches.length - 1
            ][1],
            10
          );
      }

      console.log(
        `${figureNumber} | ${figureTitle} | PDF page ${pdfPage ?? 'unknown'}`
      );
    }

  } finally {
    await parser.destroy();
  }
}

inspectDukeMaps().catch(error => {
  console.error(
    'Map inspection failed:',
    error
  );

  process.exitCode = 1;
});