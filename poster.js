// WordPress Site Config
const WP_SITE_URL = "https://telenorquizpk.rf.gd";
const PAGE_ID = 26; // Today Telenor Answer Page ID

// Temporary Credentials / Application Password
const WP_USERNAME = "Haji"; 
const WP_APP_PASSWORD = "YOUR_APPLICATION_PASSWORD_HERE"; 

async function updateTelenorPage(quizData) {
    const endpoint = `${WP_SITE_URL}/wp-json/wp/v2/pages/${PAGE_ID}`;
    
    // Auth header Base64
    const authHeader = "Basic " + btoa(`${WP_USERNAME}:${WP_APP_PASSWORD}`);

    // Post HTML Content Format
    const pageContent = `
        <h2>My Telenor Quiz Answers Today - ${new Date().toLocaleDateString('en-GB')}</h2>
        <p>Welcome! Here are today's official 5 My Telenor App Quiz answers to get free internetMBs.</p>
        <hr />
        <ol>
            <li><strong>Q1:</strong> ${quizData.q1}<br /><strong>Answer:</strong> ${quizData.a1}</li>
            <li><strong>Q2:</strong> ${quizData.q2}<br /><strong>Answer:</strong> ${quizData.a2}</li>
            <li><strong>Q3:</strong> ${quizData.q3}<br /><strong>Answer:</strong> ${quizData.a3}</li>
            <li><strong>Q4:</strong> ${quizData.q4}<br /><strong>Answer:</strong> ${quizData.a4}</li>
            <li><strong>Q5:</strong> ${quizData.q5}<br /><strong>Answer:</strong> ${quizData.a5}</li>
        </ol>
        <hr />
        <p><em>Updated daily on TelenorQuizPK.</em></p>
    `;

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader
            },
            body: JSON.stringify({
                content: pageContent
            })
        });

        if (response.ok) {
            console.log("✅ Page ID 26 successfully updated!");
        } else {
            const err = await response.json();
            console.error("❌ Error updating page:", err);
        }
    } catch (error) {
        console.error("❌ Network or API Error:", error);
    }
}

// Example Execution
const sampleAnswers = {
    q1: "Question 1 Text Here", a1: "Correct Answer 1",
    q2: "Question 2 Text Here", a2: "Correct Answer 2",
    q3: "Question 3 Text Here", a3: "Correct Answer 3",
    q4: "Question 4 Text Here", a4: "Correct Answer 4",
    q5: "Question 5 Text Here", a5: "Correct Answer 5"
};

// Run Function
updateTelenorPage(sampleAnswers);
