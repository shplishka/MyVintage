import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MyVintage API',
            version: '1.0.0',
            description: 'API documentation for MyVintage',
        },
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                AuthTokens: {
                    type: 'object',
                    properties: {
                        accessToken:  { type: 'string' },
                        refreshToken: { type: 'string' },
                    },
                },
                Comment: {
                    type: 'object',
                    properties: {
                        _id:       { type: 'string' },
                        post:      { type: 'string' },
                        author:    { $ref: '#/components/schemas/User' },
                        content:   { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        _id:            { type: 'string' },
                        username:       { type: 'string' },
                        email:          { type: 'string' },
                        profilePicture: { type: 'string', nullable: true },
                        biography:      { type: 'string', nullable: true },
                        createdAt:      { type: 'string', format: 'date-time' },
                        updatedAt:      { type: 'string', format: 'date-time' },
                    },
                },
            },
        },
    },
    apis: ['./src/routes/*.ts'],
};

export default swaggerJsdoc(options);
