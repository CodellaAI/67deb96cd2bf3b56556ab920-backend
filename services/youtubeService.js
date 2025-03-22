
const youtubeDl = require('youtube-dl-exec');

// Convert time format (mm:ss or hh:mm:ss) to seconds
const timeToSeconds = (timeStr) => {
  if (!timeStr || timeStr === '0:00') return 0;
  
  const parts = timeStr.split(':').map(Number);
  
  if (parts.length === 2) {
    // mm:ss format
    return parts[0] * 60 + parts[1];
  } else if (parts.length === 3) {
    // hh:mm:ss format
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  
  return 0;
};

// Extract YouTube video ID from URL
const extractVideoId = (url) => {
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

// Extract video information from YouTube
const extractVideoInfo = async (youtubeUrl, startTime = '0:00', endTime = '') => {
  try {
    const videoId = extractVideoId(youtubeUrl);
    
    if (!videoId) {
      throw new Error('Invalid YouTube URL');
    }
    
    // Get video info using youtube-dl
    const videoInfo = await youtubeDl(youtubeUrl, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      youtubeSkipDashManifest: true,
    });
    
    // Convert time formats to seconds
    const startTimeSeconds = timeToSeconds(startTime);
    const endTimeSeconds = endTime ? timeToSeconds(endTime) : null;
    
    // Format duration for display
    let duration = '';
    if (videoInfo.duration) {
      const totalSeconds = videoInfo.duration;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      if (hours > 0) {
        duration = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      } else {
        duration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
      }
    }
    
    // Calculate clip duration if both start and end times are provided
    let clipDuration = '';
    if (endTimeSeconds && startTimeSeconds < endTimeSeconds) {
      const durationSeconds = endTimeSeconds - startTimeSeconds;
      const minutes = Math.floor(durationSeconds / 60);
      const seconds = durationSeconds % 60;
      clipDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    return {
      videoId,
      title: videoInfo.title,
      thumbnailUrl: videoInfo.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      duration: clipDuration || duration,
      startTimeSeconds,
      endTimeSeconds
    };
  } catch (error) {
    console.error('YouTube extraction error:', error);
    throw new Error('Failed to extract YouTube video information. Please check the URL and try again.');
  }
};

module.exports = {
  extractVideoInfo
};
