import axios from 'axios';

const ACCESS_TOKEN =
  'NTA5Mzg2NjYtOGNlNy00MWI1LWE1ZjUtNDY3MjI5NzE4MDU1NmJhNmU2NGEtMWQw_PE93_c18e13ae-5575-4bc0-ae01-e48905f14f17';

// Create a reusable instance
const webex = axios.create({
  baseURL: 'https://webexapis.com/v1',
  headers: {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

/**
 * 1. Fetch all rooms (spaces)
 */
async function getMyRooms() {
  try {
    const response = await webex.get('/rooms', {
      params: { max: 100 }, // Adjust as needed
    });
    console.log(response.data);
    return response.data.items;
  } catch (error) {
    console.error(
      'Error fetching rooms:',
      error.response?.data || error.message
    );
    return [];
  }
}

/**
 * 2. Fetch mentions directed at 'me' in a specific room
 */
async function getMentionsInRoom(roomId) {
  try {
    const response = await webex.get('/messages', {
      params: {
        roomId: roomId,
        mentionedPeople: 'me', // Filters messages directed at you
      },
    });
    return response.data.items;
  } catch (error) {
    // If a room is empty or inaccessible, Webex may return 404/403
    return [];
  }
}

/**
 * Main Logic
 */
async function checkWebex() {
  const rooms = await getMyRooms();
  console.log(`Checking ${rooms.length} rooms for mentions...`);

  for (const room of rooms) {
    const mentions = await getMentionsInRoom(room.id);

    if (mentions.length > 0) {
      console.log(`\n📍 Room: ${room.title}`);
      mentions.forEach((msg) => {
        console.log(`   - [${msg.created}] ${msg.personEmail}: ${msg.text}`);
      });
    }
  }
}

checkWebex();
