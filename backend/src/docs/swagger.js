const swaggerUi = require('swagger-ui-express');

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'SecureWork Verify API',
    version: '1.0.0',
    description: 'Cryptographically Verifiable Workforce Credential & Qualification Verification Platform API with Ed25519 digital signatures, RFC 8785 canonicalization, and tamper-evident audit chains.',
    contact: {
      name: 'SecureWork Verify Engineering',
      url: 'https://securework.io'
    }
  },
  servers: [
    {
      url: 'http://localhost:5000/api',
      description: 'Local Development Server'
    }
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JSON Web Token authorization header'
      },
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-key',
        description: 'Employer / Verifier ATS API Key'
      }
    },
    schemas: {
      PublicVerificationResult: {
        type: 'object',
        properties: {
          credentialId: { type: 'string' },
          title: { type: 'string' },
          status: { type: 'string', enum: ['ACTIVE', 'REVOKED', 'EXPIRED', 'TAMPERED'] },
          verified: { type: 'boolean' },
          confidenceScore: { type: 'number' },
          issuer: {
            type: 'object',
            properties: {
              issuerCode: { type: 'string' },
              organizationName: { type: 'string' },
              officialDomain: { type: 'string' }
            }
          },
          cryptography: {
            type: 'object',
            properties: {
              algorithm: { type: 'string' },
              signatureFingerprint: { type: 'string' },
              documentHash: { type: 'string' }
            }
          }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        summary: 'System Health & Telemetry',
        description: 'Returns database connection status, storage driver, OCR status, and audit chain head hash.',
        responses: {
          '200': { description: 'Health telemetry report' }
        }
      }
    },
    '/public/verify/{id}': {
      get: {
        summary: 'Public Verification (No Login Required)',
        description: 'Validates credential integrity, checks signature, revocation registry, and returns explainable confidence score.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Public verification result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/PublicVerificationResult' }
              }
            }
          }
        }
      }
    },
    '/public/pdf/{id}': {
      get: {
        summary: 'Download PDF Certificate',
        description: 'Generates a PDF certificate with embedded QR code, signatures, and tamper-evident markings.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          '200': { description: 'PDF binary stream', content: { 'application/pdf': {} } }
        }
      }
    },
    '/public/bundle/{id}': {
      get: {
        summary: 'Download Offline Bundle',
        description: 'Downloads a canonicalized JCS bundle for pure offline Node.js crypto verification.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Offline JSON bundle' } }
      }
    },
    '/public/w3c/{id}': {
      get: {
        summary: 'Export W3C Verifiable Credential',
        description: 'Returns W3C VC Data Model JSON-LD representation with cryptographic proof block.',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'W3C JSON-LD credential' } }
      }
    },
    '/v1/verify': {
      post: {
        summary: 'B2B Verification Endpoint',
        description: 'Automated verification endpoint for employer ATS integrations authenticated via x-api-key.',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['credentialId'],
                properties: {
                  credentialId: { type: 'string' },
                  documentHash: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Cryptographic verification evaluation result' }
        }
      }
    },
    '/credentials/bulk-issue': {
      post: {
        summary: 'Bulk Issue Credentials (CSV)',
        description: 'Issues a batch of credentials from structured row data.',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['issuerId', 'rows'],
                properties: {
                  issuerId: { type: 'string' },
                  rows: {
                    type: 'array',
                    items: {
                      type: 'object',
                      required: ['recipientEmail', 'title'],
                      properties: {
                        recipientEmail: { type: 'string' },
                        recipientName: { type: 'string' },
                        title: { type: 'string' },
                        credentialType: { type: 'string' },
                        expiresAt: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        responses: { '201': { description: 'Bulk issuance batch report' } }
      }
    }
  }
};

function setupSwaggerDocs(app) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get('/api/openapi.json', (req, res) => res.json(openApiSpec));
}

module.exports = {
  setupSwaggerDocs,
  openApiSpec
};
