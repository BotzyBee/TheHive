<script>
    import Sidebar from '$lib/componants/Sidebar.svelte';
    import BotzyLogo from '$lib/logoSml.png';
    import LayoutCombine from '$lib/componants/layoutCombine.svelte';
    import { callTaskApi, checkForUpdate, postAmendApi, stopTask } from '$lib/code/aiJobs/call.js';
    import { marked } from 'marked';
    import DOMPurify from 'dompurify';

    let isSidebarCollapsed = true;
    function toggleSidebar() {
        isSidebarCollapsed = !isSidebarCollapsed;
    }

</script>

<div class="app-container">
    <!-- SIDEBAR -->
    <!-- Note: Svelte transitions require the element to be removed from the DOM -->
    <Sidebar 
        bind:isSidebarCollapsed={isSidebarCollapsed} 
        on:toggle={toggleSidebar} 
    />
    <!-- MAIN CONTENT -->
    <main class="main-content">
            <div class="dashboard-container">
            <!-- First -->
            <div class="portal" style="padding: 15px;">
                <h2 style="padding-bottom: 15px; color:darkgray">Woah.. we're still building here 🏗️</h2>                
            </div>
        </div>
    </main>
</div>

<style>
    /* Global variables and layout styles remain here */
    :root {
        --input-form-max-width: 768px;
        --primary-blue: #4285f4;
        --primary-blue-dark: #357ae8;
        --text-color-light: #fefefe;
        --text-color-dark: #333;
        --border-color: #e0e0e0;
        --shadow-light: 0 2px 10px rgba(0, 0, 0, 0.08);
        --shadow-medium: 0 4px 20px rgba(0, 0, 0, 0.1);
        --user-message-bg: #f0f4f9;
        --ai-message-bg: #e6f0ff;
        --ai-message-border: #005188;
        --user-message-border: #0098ac;
    }

    .app-container {
        display: flex;
        min-height: 100vh;
        height: 100vh;
        box-sizing: border-box;
    }

    .main-content {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        box-sizing: border-box;
    }

    .dashboard-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        width: 100%;
        max-width: 1200px;
        margin: auto;
    }

    .portal {
        width: 100%;
        height: 500px;
        border: none;
        border-radius: 0.75rem;
        box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
        background-color: azure;
    }
</style>