
const mongoose = require('mongoose');

const LikeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clip: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Clip'
  },
  comment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },
  type: {
    type: String,
    enum: ['clip', 'comment'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// A user can only like a clip or comment once
LikeSchema.index({ user: 1, clip: 1, type: 1 }, { unique: true, sparse: true });
LikeSchema.index({ user: 1, comment: 1, type: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Like', LikeSchema);
