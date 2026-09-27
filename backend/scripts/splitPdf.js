const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

async function main() {
  const inputPath = process.argv[2];
  const pagesPerChunk = Number(process.argv[3] || 75);

  if (!inputPath) {
    console.error(
      'Usage: node scripts/splitPdf.js "<pdf-path>" [pages-per-chunk]'
    );
    process.exit(1);
  }

  if (!fs.existsSync(inputPath)) {
    console.error(`PDF not found: ${inputPath}`);
    process.exit(1);
  }

  if (
    !Number.isInteger(pagesPerChunk) ||
    pagesPerChunk <= 0
  ) {
    console.error(
      'pages-per-chunk must be a positive integer.'
    );
    process.exit(1);
  }

  const absoluteInput = path.resolve(inputPath);

  const pdfBytes = fs.readFileSync(absoluteInput);

  const sourcePdf = await PDFDocument.load(pdfBytes);

  const totalPages = sourcePdf.getPageCount();

  console.log('');
  console.log('GRIDLOCK PDF SPLITTER');
  console.log('='.repeat(60));
  console.log(`Source: ${absoluteInput}`);
  console.log(`Total pages: ${totalPages}`);
  console.log(`Pages per chunk: ${pagesPerChunk}`);
  console.log('');

  const baseName = path.basename(
    absoluteInput,
    path.extname(absoluteInput)
  );

  const outputDirectory = path.join(
    path.dirname(absoluteInput),
    'chunks',
    baseName
  );

  fs.mkdirSync(outputDirectory, {
    recursive: true
  });

  let partNumber = 1;

  for (
    let startPage = 0;
    startPage < totalPages;
    startPage += pagesPerChunk
  ) {
    const endPage = Math.min(
      startPage + pagesPerChunk,
      totalPages
    );

    const outputPdf = await PDFDocument.create();

    const pageIndexes = [];

    for (
      let pageIndex = startPage;
      pageIndex < endPage;
      pageIndex++
    ) {
      pageIndexes.push(pageIndex);
    }

    const copiedPages =
      await outputPdf.copyPages(
        sourcePdf,
        pageIndexes
      );

    for (const page of copiedPages) {
      outputPdf.addPage(page);
    }

    const outputBytes =
      await outputPdf.save();

    const partLabel =
      String(partNumber).padStart(2, '0');

    const firstHumanPage =
      startPage + 1;

    const lastHumanPage =
      endPage;

    const outputName =
      `${baseName}-part-${partLabel}` +
      `-pages-${firstHumanPage}-${lastHumanPage}.pdf`;

    const outputPath =
      path.join(
        outputDirectory,
        outputName
      );

    fs.writeFileSync(
      outputPath,
      outputBytes
    );

    console.log(
      `Part ${partLabel}: pages ` +
      `${firstHumanPage}-${lastHumanPage}`
    );

    console.log(
      `  ${outputPath}`
    );

    partNumber++;
  }

  console.log('');
  console.log('='.repeat(60));
  console.log(
    `Created ${partNumber - 1} PDF chunk(s).`
  );
  console.log(
    `Output directory: ${outputDirectory}`
  );
}

main().catch((error) => {
  console.error('');
  console.error('PDF SPLIT FAILED');
  console.error('='.repeat(60));
  console.error(error);
  process.exit(1);
});