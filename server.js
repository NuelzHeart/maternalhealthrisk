// server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const app = express();
const prisma = new PrismaClient();

// Test DB connection
prisma.$connect()
  .then(() => {
    console.log('✅ Connected to the database successfully.');
  })
  .catch((error) => {
    console.error('❌ Failed to connect to the database:', error);
    process.exit(1); // Stop the server if DB connection fails
  });


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify admin token
const verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const admin = await prisma.admin.findUnique({
      where: { id: decoded.adminId }
    });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.admin = admin;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Admin Authentication Routes
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const admin = await prisma.admin.findUnique({
      where: { email }
    });

    if (!admin) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: '24h' });

    res.json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/admin/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if admin already exists
    const existingAdmin = await prisma.admin.findUnique({
      where: { email }
    });

    if (existingAdmin) {
      return res.status(400).json({ error: 'Admin already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await prisma.admin.create({
      data: {
        name,
        email,
        password: hashedPassword
      }
    });

    const token = jwt.sign({ adminId: admin.id }, JWT_SECRET, { expiresIn: '24h' });

    res.status(201).json({
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health Assessment Routes
app.post('/api/assessments', async (req, res) => {
  try {
    const {
      patientName,
      age,
      systolic,
      diastolic,
      bloodSugar,
      temperature,
      isFasting,
      bpRisk,
      sugarRisk,
      tempRisk,
      totalScore,
      overallRisk
    } = req.body;

    const assessment = await prisma.healthAssessment.create({
      data: {
        patientName,
        age,
        systolic,
        diastolic,
        bloodSugar,
        temperature,
        isFasting,
        bpRiskLevel: bpRisk.risk,
        bpRiskScore: bpRisk.score,
        sugarRiskLevel: sugarRisk.risk,
        sugarRiskScore: sugarRisk.score,
        tempRiskLevel: tempRisk.risk,
        tempRiskScore: tempRisk.score,
        totalScore,
        overallRisk
      }
    });

    res.status(201).json({
      success: true,
      assessment
    });
  } catch (error) {
    console.error('Assessment creation error:', error);
    res.status(500).json({ error: 'Failed to save assessment' });
  }
});

// Admin-only routes for data management
app.get('/api/admin/assessments', verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '' } = req.query;
    const skip = (page - 1) * limit;

    const where = search ? {
      patientName: {
        contains: search,
        mode: 'insensitive'
      }
    } : {};

    const [assessments, total] = await Promise.all([
      prisma.healthAssessment.findMany({
        where,
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.healthAssessment.count({ where })
    ]);

    res.json({
      assessments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Fetch assessments error:', error);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

app.get('/api/admin/assessments/export', verifyAdmin, async (req, res) => {
  try {
    const assessments = await prisma.healthAssessment.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format data for export
    const exportData = assessments.map(assessment => ({
      'Date': assessment.createdAt.toLocaleDateString(),
      'Time': assessment.createdAt.toLocaleTimeString(),
      'Patient Name': assessment.patientName,
      'Age': assessment.age,
      'Systolic BP': assessment.systolic,
      'Diastolic BP': assessment.diastolic,
      'Blood Sugar': assessment.bloodSugar,
      'Fasting': assessment.isFasting ? 'Yes' : 'No',
      'Temperature': assessment.temperature,
      'BP Risk': assessment.bpRiskLevel,
      'Sugar Risk': assessment.sugarRiskLevel,
      'Temp Risk': assessment.tempRiskLevel,
      'Overall Risk': assessment.overallRisk,
      'Total Score': assessment.totalScore
    }));

    res.json(exportData);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

app.delete('/api/admin/assessments/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.healthAssessment.delete({
      where: { id: parseInt(id) }
    });

    res.json({ success: true, message: 'Assessment deleted successfully' });
  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
});

app.delete('/api/admin/assessments', verifyAdmin, async (req, res) => {
  try {
    await prisma.healthAssessment.deleteMany({});
    res.json({ success: true, message: 'All assessments deleted successfully' });
  } catch (error) {
    console.error('Delete all assessments error:', error);
    res.status(500).json({ error: 'Failed to delete all assessments' });
  }
});

// Statistics endpoint for admin dashboard
app.get('/api/admin/stats', verifyAdmin, async (req, res) => {
  try {
    const [
      totalAssessments,
      highRiskCount,
      midRiskCount,
      lowRiskCount,
      recentAssessments
    ] = await Promise.all([
      prisma.healthAssessment.count(),
      prisma.healthAssessment.count({
        where: { overallRisk: { contains: 'High Risk' } }
      }),
      prisma.healthAssessment.count({
        where: { overallRisk: { contains: 'Mid Risk' } }
      }),
      prisma.healthAssessment.count({
        where: { overallRisk: { contains: 'Low Risk' } }
      }),
      prisma.healthAssessment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          patientName: true,
          overallRisk: true,
          createdAt: true
        }
      })
    ]);

    res.json({
      totalAssessments,
      riskDistribution: {
        high: highRiskCount,
        mid: midRiskCount,
        low: lowRiskCount
      },
      recentAssessments
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin panel
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Main app: http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin`);
});