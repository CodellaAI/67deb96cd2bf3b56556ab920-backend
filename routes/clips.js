
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const auth = require('../middleware/auth');
const Clip = require('../models/Clip');
const Comment = require('../models/Comment');
const Like = require('../models/Like');
const youtubeService = require('../services/youtubeService');

// @route   POST /api/clips
// @desc    Create a new clip
// @access  Private
router.post(
  '/',
  [
    auth,
    body('youtubeUrl').isURL().withMessage('Please provide a valid YouTube URL'),
    body('title').trim().isLength({ min: 1, max: 100 }).withMessage('Title is required and must be less than 100 characters'),
    body('description').optional().trim().isLength({ max: 500 }).withMessage('Description must be less than 500 characters')
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), message: errors.array()[0].msg });
    }

    try {
      const { youtubeUrl, title, description, startTime, endTime } = req.body;

      // Extract YouTube video info
      const videoInfo = await youtubeService.extractVideoInfo(youtubeUrl, startTime, endTime);
      
      // Create new clip
      const clip = new Clip({
        title,
        description,
        youtubeUrl,
        youtubeVideoId: videoInfo.videoId,
        thumbnailUrl: videoInfo.thumbnailUrl,
        duration: videoInfo.duration,
        startTimeSeconds: videoInfo.startTimeSeconds,
        endTimeSeconds: videoInfo.endTimeSeconds,
        user: req.user.id
      });

      await clip.save();

      // Populate user info
      await clip.populate('user', 'username avatar');

      res.status(201).json({ 
        message: 'Clip created successfully', 
        clip 
      });
    } catch (err) {
      console.error('Error creating clip:', err);
      if (err.message.includes('YouTube')) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   GET /api/clips
// @desc    Get all clips with pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const clips = await Clip.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'username avatar')
      .lean();

    // Get total count for pagination
    const total = await Clip.countDocuments();

    // Get likes and comments count for each clip
    const clipsWithCounts = await Promise.all(clips.map(async (clip) => {
      const likesCount = await Like.countDocuments({ clip: clip._id, type: 'clip' });
      const commentsCount = await Comment.countDocuments({ clip: clip._id });

      // Check if the user has liked the clip (if authenticated)
      let isLiked = false;
      if (req.headers.authorization) {
        try {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const userId = decoded.user.id;
          
          const like = await Like.findOne({ 
            user: userId, 
            clip: clip._id,
            type: 'clip'
          });
          
          isLiked = !!like;
        } catch (error) {
          // Token validation failed, but we'll continue without user-specific data
        }
      }

      return {
        ...clip,
        likesCount,
        commentsCount,
        isLiked
      };
    }));

    res.json({
      clips: clipsWithCounts,
      page,
      totalPages: Math.ceil(total / limit),
      totalClips: total,
      hasMore: page * limit < total
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/clips/:id
// @desc    Get a single clip by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const clip = await Clip.findById(req.query.id)
      .populate('user', 'username avatar')
      .lean();

    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    // Get likes and comments count
    const likesCount = await Like.countDocuments({ clip: clip._id, type: 'clip' });
    const commentsCount = await Comment.countDocuments({ clip: clip._id });

    // Check if the user has liked the clip (if authenticated)
    let isLiked = false;
    if (req.headers.authorization) {
      try {
        const token = req.headers.authorization.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.user.id;
        
        const like = await Like.findOne({ 
          user: userId, 
          clip: clip._id,
          type: 'clip'
        });
        
        isLiked = !!like;
      } catch (error) {
        // Token validation failed, but we'll continue without user-specific data
      }
    }

    res.json({
      clip: {
        ...clip,
        likesCount,
        commentsCount,
        isLiked
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/clips/user/:userId
// @desc    Get clips by user ID
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    
    const clips = await Clip.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('user', 'username avatar')
      .lean();

    // Get likes and comments count for each clip
    const clipsWithCounts = await Promise.all(clips.map(async (clip) => {
      const likesCount = await Like.countDocuments({ clip: clip._id, type: 'clip' });
      const commentsCount = await Comment.countDocuments({ clip: clip._id });

      return {
        ...clip,
        likesCount,
        commentsCount
      };
    }));

    res.json({ clips: clipsWithCounts });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/clips/:id/like
// @desc    Like or unlike a clip
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
  try {
    const clipId = req.params.id;
    
    // Check if clip exists
    const clip = await Clip.findById(clipId);
    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    // Check if user already liked this clip
    const existingLike = await Like.findOne({ 
      user: req.user.id, 
      clip: clipId,
      type: 'clip'
    });

    if (existingLike) {
      // Unlike the clip
      await Like.findByIdAndDelete(existingLike._id);
      
      // Get updated likes count
      const likesCount = await Like.countDocuments({ clip: clipId, type: 'clip' });
      
      return res.json({ 
        message: 'Clip unliked successfully', 
        isLiked: false,
        likesCount
      });
    }

    // Create new like
    const like = new Like({
      user: req.user.id,
      clip: clipId,
      type: 'clip'
    });

    await like.save();
    
    // Get updated likes count
    const likesCount = await Like.countDocuments({ clip: clipId, type: 'clip' });

    res.json({ 
      message: 'Clip liked successfully', 
      isLiked: true,
      likesCount
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/clips/:id/comments
// @desc    Add a comment to a clip
// @access  Private
router.post(
  '/:id/comments',
  [
    auth,
    body('content').trim().isLength({ min: 1, max: 500 }).withMessage('Comment cannot be empty and must be less than 500 characters')
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array(), message: errors.array()[0].msg });
    }

    try {
      const clipId = req.params.id;
      
      // Check if clip exists
      const clip = await Clip.findById(clipId);
      if (!clip) {
        return res.status(404).json({ message: 'Clip not found' });
      }

      // Create new comment
      const comment = new Comment({
        content: req.body.content,
        user: req.user.id,
        clip: clipId
      });

      await comment.save();
      
      // Populate user info
      await comment.populate('user', 'username avatar');

      res.status(201).json({ 
        message: 'Comment added successfully', 
        comment 
      });
    } catch (err) {
      console.error(err.message);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// @route   GET /api/clips/:id/comments
// @desc    Get comments for a clip
// @access  Public
router.get('/:id/comments', async (req, res) => {
  try {
    const clipId = req.params.id;
    
    const comments = await Comment.find({ clip: clipId })
      .sort({ createdAt: -1 })
      .populate('user', 'username avatar')
      .lean();

    // Get likes count for each comment
    const commentsWithLikes = await Promise.all(comments.map(async (comment) => {
      const likesCount = await Like.countDocuments({ 
        comment: comment._id, 
        type: 'comment' 
      });

      // Check if the user has liked the comment (if authenticated)
      let isLiked = false;
      if (req.headers.authorization) {
        try {
          const token = req.headers.authorization.split(' ')[1];
          const decoded = jwt.verify(token, process.env.JWT_SECRET);
          const userId = decoded.user.id;
          
          const like = await Like.findOne({ 
            user: userId, 
            comment: comment._id,
            type: 'comment'
          });
          
          isLiked = !!like;
        } catch (error) {
          // Token validation failed, but we'll continue without user-specific data
        }
      }

      return {
        ...comment,
        likesCount,
        isLiked
      };
    }));

    res.json({ comments: commentsWithLikes });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/clips/:id
// @desc    Delete a clip
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const clip = await Clip.findById(req.params.id);

    if (!clip) {
      return res.status(404).json({ message: 'Clip not found' });
    }

    // Check if user owns the clip
    if (clip.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'User not authorized to delete this clip' });
    }

    // Delete associated comments and likes
    await Comment.deleteMany({ clip: req.params.id });
    await Like.deleteMany({ clip: req.params.id, type: 'clip' });

    // Delete the clip
    await Clip.findByIdAndDelete(req.params.id);

    res.json({ message: 'Clip deleted successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
