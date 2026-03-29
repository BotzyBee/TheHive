import axios from "axios";

export async function callTaskApi(userInput) {
    try {
        const apiUrl = `http://localhost:3000/task?prompt=${encodeURIComponent(userInput)}`;
        const response = await axios.get(apiUrl);
        return response.data;
    } catch (error) {
        // Log the error for debugging purposes
        console.error('Error calling the API:', error);
        throw error;
    }
}

export async function postAmendApi(prompt, jobID) {
    try {
        const apiUrl = `http://localhost:3000/amendOrAuth`;        
        // axios.post sends the taskPayload object as JSON in the request body.
        const response = await axios.post(apiUrl, { task: { amend: {prompt, jobID } } });
        // Return the data received from the API
        return response.data;
    } catch (error) {
        // Log the error for debugging purposes
        console.error('Error calling the API:', error);
        throw error;
    }
}

export async function stopTask(jobID) {
    try {
        const apiUrl = `http://localhost:3000/amendOrAuth`;        
        // axios.post sends the taskPayload object as JSON in the request body.
        const response = await axios.post(apiUrl, { task: { stop: jobID } });
        // Return the data received from the API
        return response.data;
    } catch (error) {
        // Log the error for debugging purposes
        console.error('Error calling the API:', error);
        throw error;
    }
}

export async function checkForUpdate(jobID){
        try {
    const apiUrl = `http://localhost:3000/getResult?jobID=${encodeURIComponent(jobID)}`;
        const response = await axios.get(apiUrl);
        return response.data;
    } catch (error) {
        // Log the error for debugging purposes
        console.error('Error getting update:', error);
        throw error;
    }
}