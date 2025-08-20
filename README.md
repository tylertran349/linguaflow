# [LinguaFlow](https://tylertran349.github.io/linguaflow/) 

## Overview

This application is a sophisticated language learning tool designed to assist users in their journey to master a new language. By leveraging the power of Google's Gemini large language model, this tool provides a dynamic and interactive learning experience. Users can generate custom exercises, including sentence construction, reading comprehension, and conversational practice, all tailored to their specific language goals and difficulty level.

The primary objective of this project is to create an immersive learning environment that moves beyond static flashcards and offers contextual, AI-generated content to enhance vocabulary, grammar, and overall fluency.

## Key Features

*   **Custom Sentence Generation**: Create color-coded sentences with chunked translations to understand grammar and structure.
*   **Reading Comprehension**: Practice reading with short passages followed by multiple-choice questions to test understanding.
*   **Sentence Unscramble**: Test your knowledge by rearranging scrambled words to form correct sentences.
*   **Conversation Practice**: Generate engaging, open-ended questions to practice forming your own responses.
*   **Personalized Learning**: Customize your experience by selecting your native and target languages, a CEFR difficulty level, and optional topics.
*   **Text-to-Speech**: Listen to the correct pronunciation of any word or sentence.

## Getting Started

To use this application on your own computer, you will need two things: the application's code and a special access key from Google. The following instructions will guide you through the entire process.

## Getting Your Google Gemini API Key (required)

1. Open your web browser and navigate to [https://console.cloud.google.com/projectcreate](https://console.cloud.google.com/projectcreate) (log in with your Google account if prompted).

2. Under the "Project name" input field, give your project any name, and click on the "Create" button.

3. Go to [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey) and log in with your Google account if prompted.

4. Click on "Get API key"

5. Click on the blue **"+ Create API key"** button near the top right corner of the page.

6. Click on the "Search Google Cloud projects" input field and in the dropdown menu, select the Google Cloud project you created in step 2.

7. Click the blue **"Create API key in existing project"** button. Copy the generated API key (it is a long string of random letters and numbers) and save it somewhere safe for the next section (like a temporary text file).

## Running the Application Locally (required for the Google Translate TTS option, optional otherwise)

### 1. Prerequisites

Before you begin, ensure you have the following software installed on your computer:
*   **Node.js and npm:** This application requires Node.js to run. The Node Package Manager (npm), which is used to install the project's dependencies, is included automatically with the Node.js installation. You can download the **LTS** version from [nodejs.org](https://nodejs.org/).
*   **Git:** This is required to download (or "clone") the project files from GitHub. You can download it from [git-scm.com/downloads](https://git-scm.com/downloads).

### 2. Installation and Setup

1.  Open your terminal (e.g., Command Prompt, PowerShell, or Terminal on macOS/Linux) and run the following command to download the project files:
    ```bash
    git clone https://github.com/tylertran349/linguaflow.git
    ```

2.  Change your current location in the terminal to the newly created project folder:
    ```bash
    cd linguaflow
    ```

3.  Run the following command to install all the necessary software libraries the project relies on. This may take a few minutes.
    ```bash
    npm install
    ```

### 3. Launching the Application

1.  Once the installation is complete, run the following command to start the application:
    ```bash
    npm start
    ```

2.  This command will start the application and automatically open it in your default web browser, typically at the address `http://localhost:3000`.

3.  In the running application, navigate to the settings menu. Paste the Google Gemini API key you obtained earlier into the designated field to begin generating content.
## How to Use

1. Open the settings panel to select your native language, the language you want to learn, and the CEFR difficulty level. You can provide a topic/theme to guide the AI in generating more relevant content for you (optional).
2. Select one of the learning modules (e.g., "Sentence Generator," "Unscramble Words", "Read & Respond", etc.).
3. On the learning module displayed on your screen, click on the generate button to have the AI generate custom sentences or exercises.