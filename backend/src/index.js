const express = require('express');
const dotenv = require('dotenv');
const fileRoutes = require('../routes/fileRoutes');
const path = require('path');
const cors = require('cors');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors());

// Middleware to parse JSON
app.use(express.json());

// Static folder for uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// File routes
app.use('/api/files', fileRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
