
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Clip = require('../models/Clip');

// @route   GET /api/users/:id
// @desc    Get user profile by ID
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -email')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get clips count
    const clipsCount = await Clip.countDocuments({ user: req.params.id });

    res.json({
      user: {
        ...user,
        clipsCount
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    const { username, bio, avatar } = req.body;
    
    // Build profile object
    const profileFields = {};
    if (username) profileFields.username = username;
    if (bio) profileFields.bio = bio;
    if (avatar) profileFields.avatar = avatar;

    // Check if username is already taken (if trying to change it)
    if (username) {
      const existingUser = await User.findOne({ username });
      if (existingUser && existingUser._id.toString() !== req.user.id) {
        return res.status(400).json({ message: 'Username is already taken' });
      }
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: profileFields },
      { new: true }
    ).select('-password');

    res.json({ user });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
