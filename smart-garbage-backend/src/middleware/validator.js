// src/middleware/validator.js
// Request Validation Middleware using Joi

const Joi = require('joi');

const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      return res.status(400).json({
        success: false,
        error: 'Validation Error',
        details,
      });
    }

    req.body = value;
    next();
  };
};

// Validation Schemas
const schemas = {
  registerUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    name: Joi.string().trim().max(255),
    phone: Joi.string().trim().max(20),
  }),

  loginUser: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),

  createComplaint: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
  }),
};

module.exports = { validateRequest, schemas };
