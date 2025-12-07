# Moodlia - Chrome Extension for Egela

Moodlia is a Chrome extension designed to enhance the learning experience on the Egela platform (University of the Basque Country). It integrates an advanced AI assistant to help students with SQL exercises, provide course guidance, and track progress. For teachers, it offers tools to configure courses, labs, and exercises, tailoring the AI's assistance to their specific curriculum.

# User Guide

## Installation

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable "Developer mode" using the toggle switch in the top right corner.
3.  Locate the provided ZIP file on your computer.
4.  Drag and drop the ZIP file directly onto the extensions page.
5.  The extension should now appear in your list of installed extensions.

## Configuration

### Loading a Configuration File

If you have a configuration file (JSON format):

1.  Right-click the extension icon and select "Options".
2.  Navigate to the "Import/Export" tab.
3.  In the "Import Configuration" section, click "Choose File" and select your JSON configuration file.
4.  Click "Import" to load the settings.

### Creating a Configuration (Teacher Mode)

To create a new configuration for your students:

1.  Open the extension popup.
2.  Go to the "Mode" tab and select "Teacher Mode".
3.  Configure the LLM settings in the Options page (see below).
4.  Navigate through the course pages to identify exercises and configure them using the "Course Config" and "Lab Config" tabs in the popup.
5.  Once configured, go to the Options page -> "Import/Export" tab and click "Export" to save the configuration to a JSON file.
6.  Distribute this file to your students.

### Configuring the LLM

1.  Right-click the extension icon and select "Options".
2.  In the "LLM Configuration" tab:
    -   Select the **Provider** (OpenAI, Google).
    -   Enter your **API Key**.
    -   Select the desired **Model** from the list.
    -   Click "Save configuration".

## Functionalities

### Common Features

#### Course Chat

The chat interface allows users to interact with the AI assistant.

-   **Ask Questions**: Users can ask questions about the course content.
-   **Context Awareness**: The assistant is aware of the current page content and exercises if a lab is open.

#### Options Page

Accessible by right-clicking the extension icon and selecting "Open settings".

-   **LLM Configuration**: Manage AI provider settings.
-   **Assistant Configuration**: Customize the behavior and prompts of the AI assistants (General, Course, Exercise, Evaluation, Explanation).
-   **Import/Export**: Manage configuration files and clear data.

### Teacher Features

#### Mode Selection

In the "Mode" tab of the popup, teachers can switch between "Student Mode" and "Teacher Mode".

-   **Student Mode**: Simulates the student experience.
-   **Teacher Mode**: Unlocks configuration tools and unrestricted access to all content.

#### Course Configuration

Allows setting up course-wide parameters.

-   **Labs**: Configure lab sequences and requirements.
-   **Progress Criteria**: Define the minimum score and percentage of challenge exercises required to pass.

#### Lab Configuration

Customize settings for specific labs.

-   **Required**: Mark labs as mandatory for the progression system.
-   **Verbosity**: Set the detail level of AI responses (Low, Medium, High).
-   **Reasoning Effort**: Adjust the AI's reasoning depth (Minimal, Low, Medium, High).

#### Exercise Configuration

Manage individual exercises within a lab.

-   **Challenge**: Use the exercise for the progression system.
-   **Picky (Tiquismiquis)**: Mark exercises where the AI is more likely to give unreliable responses to warn the students.

### Student Features

#### Chat Assistance

Students use the chat to get help with their coursework.

-   **Explanations**: Request detailed explanations exercises.
-   **Solution Checking**: Submit solutions for review. The AI provides feedback and a score.

#### Exercises Tab

Displays a list of exercises on the current page.

-   **Status**: Shows which exercises have explanations or evaluations saved.
-   **Review**: Students can revisit previous explanations and evaluation reports.

#### Progress Tracking

Students can view their progress through the course, including completed labs and challenge exercises, ensuring they meet the criteria defined by the teacher.
