const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const pool = require('../db');

const router = express.Router();


// ==========================================
// PATHS
// ==========================================

const backendRoot = path.resolve(__dirname, '../..');

const uploadDirectory = path.join(
  backendRoot,
  'data',
  'uploads'
);

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});


// ==========================================
// MULTER CONFIGURATION
// ==========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },

  filename: (req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const baseName = path
      .basename(file.originalname, extension)
      .replace(/[^a-zA-Z0-9-_]/g, '-');

    cb(
      null,
      `${Date.now()}-${baseName}${extension}`
    );
  },
});


const upload = multer({
  storage,

  limits: {
    fileSize: 25 * 1024 * 1024,
  },

  fileFilter: (req, file, cb) => {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    if (
      file.mimetype !== 'application/pdf' &&
      extension !== '.pdf'
    ) {
      return cb(
        new Error('Only PDF files are allowed.')
      );
    }

    cb(null, true);
  },
});


// ==========================================
// SHA-256
// ==========================================

function calculateSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');

    const stream = fs.createReadStream(filePath);

    stream.on('data', chunk => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(
        hash.digest('hex').toUpperCase()
      );
    });

    stream.on('error', reject);
  });
}


// ==========================================
// SCRIPT RUNNER
// ==========================================

function runScript(scriptName, argument) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(
      backendRoot,
      'scripts',
      scriptName
    );

    const child = spawn(
      process.execPath,
      [scriptPath, argument],
      {
        cwd: backendRoot,
        env: process.env,
      }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      const text = data.toString();

      stdout += text;
      console.log(text);
    });

    child.stderr.on('data', data => {
      const text = data.toString();

      stderr += text;
      console.error(text);
    });

    child.on('error', reject);

    child.on('close', code => {
      if (code === 0) {
        resolve({
          stdout,
          stderr,
        });

        return;
      }

      reject(
        new Error(
          `${scriptName} exited with code ${code}\n${stderr}`
        )
      );
    });
  });
}


// ==========================================
// DOCUMENT UPLOAD
// ==========================================

router.post(
  '/upload',
  upload.single('document'),

  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'A PDF document is required.',
      });
    }

    const pdfPath = req.file.path;

    try {

      // ======================================
      // CALCULATE DOCUMENT HASH
      // ======================================

      const sha256 = await calculateSha256(
        pdfPath
      );

      console.log('');
      console.log('DORY DOCUMENT UPLOAD');
      console.log('='.repeat(60));
      console.log(
        `PDF: ${req.file.originalname}`
      );
      console.log(
        `SHA-256: ${sha256}`
      );


      // ======================================
      // DUPLICATE DOCUMENT CHECK
      // ======================================

      const existingDocument =
        await pool.query(
          `
          SELECT
            pd.id,
            pd.sha256,
            pd.original_filename,
            pd.extraction_name,
            pd.status,
            pd.processed_at,
            u.name AS utility_name
          FROM processed_documents pd
          LEFT JOIN utilities u
            ON u.id = pd.utility_id
          WHERE pd.sha256 = $1
          LIMIT 1
          `,
          [sha256]
        );


      if (existingDocument.rowCount > 0) {
        const existing =
          existingDocument.rows[0];

        console.log(
          '✓ Document already processed.'
        );

        console.log(
          'Skipping OpenAI analysis and database import.'
        );


        // Delete duplicate temporary upload
        await fs.promises
          .unlink(pdfPath)
          .catch(() => {});


        return res.status(200).json({
          success: true,

          alreadyProcessed: true,

          message:
            'This document has already been processed.',

          document: {
            originalName:
              req.file.originalname,

            sha256,

            utility:
              existing.utility_name,

            extractionName:
              existing.extraction_name,

            processedAt:
              existing.processed_at,
          },
        });
      }


      // ======================================
      // NEW DOCUMENT
      // ======================================

      const extractionName = path
        .basename(
          pdfPath,
          path.extname(pdfPath)
        );


      const extractionDirectory = path.join(
        backendRoot,
        'data',
        'extractions',
        extractionName
      );


      const rawPath = path.join(
        extractionDirectory,
        'raw.json'
      );


      const normalizedPath = path.join(
        extractionDirectory,
        'normalized.json'
      );


      console.log(
        'New document detected.'
      );

      console.log(
        `Extraction: ${extractionName}`
      );


      // ======================================
      // 1. AI EXTRACTION
      // ======================================

      console.log('');
      console.log(
        'STEP 1/3 — AI extraction'
      );

      await runScript(
        'analyzeDocument.js',
        pdfPath
      );


      // ======================================
      // 2. NORMALIZATION
      // ======================================

      console.log('');
      console.log(
        'STEP 2/3 — Normalization'
      );

      await runScript(
        'normalizeDocument.js',
        rawPath
      );


      // ======================================
      // 3. DATABASE IMPORT
      // ======================================

      console.log('');
      console.log(
        'STEP 3/3 — PostgreSQL import'
      );

      await runScript(
        'importNormalizedExtraction.js',
        normalizedPath
      );


      // ======================================
      // READ NORMALIZED RESULT
      // ======================================

      const normalized = JSON.parse(
        fs.readFileSync(
          normalizedPath,
          'utf8'
        )
      );


      // ======================================
      // IDENTIFY UTILITY
      // ======================================

      const utilityName =
        normalized.document?.utility ??
        normalized.utility ??
        null;


      let utilityId = null;


      if (utilityName) {
        const utilityResult =
          await pool.query(
            `
            SELECT id
            FROM utilities
            WHERE name = $1
            LIMIT 1
            `,
            [utilityName]
          );


        utilityId =
          utilityResult.rows[0]?.id ??
          null;
      }


      // ======================================
      // REGISTER PROCESSED DOCUMENT
      // ======================================

      await pool.query(
        `
        INSERT INTO processed_documents (
          sha256,
          original_filename,
          utility_id,
          extraction_name,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'completed'
        )
        ON CONFLICT (sha256)
        DO NOTHING
        `,
        [
          sha256,
          req.file.originalname,
          utilityId,
          extractionName,
        ]
      );


      console.log('');
      console.log(
        '✓ Document registered as processed.'
      );


      // ======================================
      // SUCCESS RESPONSE
      // ======================================

      return res.status(201).json({
        success: true,

        alreadyProcessed: false,

        message:
          'Document analyzed and imported successfully.',

        document: {
          originalName:
            req.file.originalname,

          sha256,

          extractionName,

          utility:
            utilityName,
        },

        imported: {
          projects:
            normalized.projects?.length ??
            0,

          planEvents:
            normalized.plan_events?.length ??
            0,

          relationships:
            normalized.relationships?.length ??
            0,

          sources:
            normalized.sources?.length ??
            0,
        },
      });

    } catch (error) {

      // ======================================
      // FAILURE
      // ======================================

      console.error(
        'Document pipeline failed:',
        error
      );


      return res.status(500).json({
        success: false,

        error:
          'Document processing failed.',

        details:
          error.message,
      });
    }
  }
);


// ==========================================
// MULTER ERROR HANDLER
// ==========================================

router.use((error, req, res, next) => {

  if (error instanceof multer.MulterError) {

    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        error:
          'PDF exceeds the 25 MB upload limit.',
      });
    }


    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }


  if (
    error?.message ===
    'Only PDF files are allowed.'
  ) {
    return res.status(400).json({
      success: false,
      error: error.message,
    });
  }


  next(error);
});


module.exports = router;