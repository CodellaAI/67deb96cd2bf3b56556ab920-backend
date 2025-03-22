
const mongoose = require('mongoose');

const ClipSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  },
  youtubeUrl: {
    type: String,
    required: true
  },
  youtubeVideoId: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    default: ''
  },
  duration: {
    type: String,
    default: ''
  },
  startTimeSeconds: {
    type: Number,
    default: 0
  },
  endTimeSeconds: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Clip', ClipSchema);
