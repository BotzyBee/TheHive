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
                <h2 style="padding-bottom: 15px; color:darkgray">AI Provider Dashboards</h2>
                <a href="https://platform.openai.com/usage"
                    target="_blank" 
                    >
                    <p style="padding-bottom: 5px;">Open AI</p>
                </a>
                <a href="https://console.cloud.google.com/billing?inv=1&invt=Ab1EiA"
                    target="_blank" 
                    >
                    <p style="padding-bottom: 5px;">Gemini</p>
                </a>
                <a href="https://console.anthropic.com/usage"
                    target="_blank" 
                    >
                    <p style="padding-bottom: 5px;">Anthropic</p>
                </a>
                <a href="https://portal.withorb.com/view?token=IjRSOXR1VXVaSlIyWU4ySm8i.CDfJceDjvDD-ck0CJ4XV3Ikmz20"
                    target="_blank" 
                    >
                    <p style="padding-bottom: 5px;">Perplexity</p>
                </a>
                <a href="https://platform.inceptionlabs.ai/"
                    target="_blank" 
                    >
                    <p style="padding-bottom: 5px;">Inception</p>
                </a>
                

                <h2 style="padding-bottom: 15px; padding-top:20px; color:darkgray">Other Dashboards</h2>
                <a href="https://railway.com/dashboard"
                    target="_blank" 
                    >
                    <p style="padding-bottom: 5px;">Railway</p>
                </a>
                <a href="https://dash.cloudflare.com/80bc3ba890ed8bc85f7c62018f93b6d6/botzybee.com"
                    target="_blank" 
                    >
                    <p style="padding-bottom: 5px;">Cloudflare</p>
                </a>
                
            </div>

            <!-- Second -->
            <div 
                class="portal" 
            ></div>

            <!-- Third -->
            <div 
                class="portal"
                style="margin-bottom: 20px;" 
            ></div>
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