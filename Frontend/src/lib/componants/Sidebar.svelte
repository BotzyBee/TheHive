<script>
    import { quintOut } from 'svelte/easing';
    import { slide } from 'svelte/transition';
    import BotzyLogo from '$lib/logoSml.png';

    export let isSidebarCollapsed = true; // input param

    // The 'toggleSidebar' function is now an event dispatcher
    // The parent component will listen for this event (on:toggle)
    import { createEventDispatcher } from 'svelte';
    const dispatch = createEventDispatcher();
    function toggleSidebar() {
        dispatch('toggle');
    }
</script>

{#if !isSidebarCollapsed}
<aside
    class="sidebar"
    transition:slide={{ axis: 'x', duration: 300, easing: quintOut }}
>
    <div class="sidebar-header">
        <div class="sidebar-branding">
            <img src={BotzyLogo} alt="Botzy Logo" class="sidebar-logo"/>
            <h2 class="sidebar-title">Botzy Bee</h2>
        </div>
        <button
            class="collapse-button"
            on:click={toggleSidebar}
            aria-label="Close Sidebar"
        >
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
        </button>
    </div>
    <ul>
        <li><a href="/">Home</a></li>
        <li><a href="/task">Task</a></li>
        <li><a href="/dashboard">Dashboard</a></li>
        <li><a href="https://primary-production-05a5c.up.railway.app/" target="_blank">N8N</a></li>
    </ul>
</aside>
{/if}

<button
    class="open-sidebar-btn"
    class:show={isSidebarCollapsed}
    on:click={toggleSidebar}
    aria-label="Open Sidebar"
>
    <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#000000"><path d="M120-240v-80h720v80H120Zm0-200v-80h720v80H120Zm0-200v-80h720v80H120Z"/></svg>
</button>

<style>
    /* All CSS related to the sidebar, buttons, and branding has been
       moved here. This includes styles for the `.sidebar`, `.collapse-button`,
       `.open-sidebar-btn`, and their child elements.
    */
    :root {
        --sidebar-width: 250px;
        --open-btn-size: 48px;
        --primary-blue: #4285f4;
        --shadow-light: 0 2px 10px rgba(0, 0, 0, 0.08);
        --text-color-dark: #333;
    }

    .sidebar {
        width: var(--sidebar-width);
        background-color: #ffffff;
        padding: 20px;
        box-shadow: var(--shadow-light);
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        flex-shrink: 0;
        overflow: hidden;
        z-index: 10;
        position: relative;
        transition: width 0.3s ease-in-out, padding 0.3s ease-in-out;
    }

    .sidebar-logo {
        width: 32px;
        height: 32px;
    }

    .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        gap: 8px;
        margin-bottom: 20px;
        box-sizing: border-box;
    }

    .sidebar-branding {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 1;
        min-width: 0;
    }

    .sidebar-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--text-color-dark);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .sidebar ul {
        list-style: none;
        padding: 0;
        margin: 0;
        width: 100%;
    }

    .sidebar ul li {
        margin-bottom: 8px;
    }

    .sidebar ul li a {
        display: block;
        padding: 10px 15px;
        border-radius: 8px;
        color: var(--text-color-dark);
        text-decoration: none;
        transition: background-color 0.2s ease, color 0.2s ease;
    }

    .sidebar ul li a:hover {
        background-color: #f0f0f0;
        color: var(--primary-blue);
    }

    .collapse-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #666;
        transition: background-color 0.2s ease, color 0.2s ease;
        flex-shrink: 0;
        margin-left: auto;
        height: 36px;
        width: 36px;
    }

    .collapse-button:hover {
        background-color: #f0f0f0;
        color: #333;
    }

    .collapse-button svg {
        fill: currentColor;
        width: 20px;
        height: 20px;
    }

    .open-sidebar-btn {
        position: fixed;
        left: 0;
        top: 120px;
        z-index: 5;
        background-color: var(--text-color-dark);
        color: white;
        border: none;
        width: var(--open-btn-size);
        height: var(--open-btn-size);
        display: flex;
        justify-content: center;
        align-items: center;
        cursor: pointer;
        border-top-right-radius: 8px;
        border-bottom-right-radius: 8px;
        box-shadow: 2px 0 5px rgba(0,0,0,0.2);
        transition: transform 0.3s ease-in-out;
        transform: translateX(-100%);
    }

    .open-sidebar-btn.show {
        transform: translateX(0);
    }

    .open-sidebar-btn svg {
        fill: currentColor;
    }

    /* Responsive adjustments for smaller screens */
    @media (max-width: 768px) {
        .sidebar {
            position: fixed;
            height: 100vh;
            top: 0;
            left: 0;
            width: var(--sidebar-width);
            transform: translateX(-100%);
            transition: transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
        }

        .sidebar:not(.collapsed) {
            transform: translateX(0%);
            box-shadow: 2px 0 10px rgba(0,0,0,0.2);
        }

        .sidebar.collapsed {
            transform: translateX(-100%);
        }

        .open-sidebar-btn {
            transform: translateX(0);
            left: 0;
            top: 10px;
        }
    }
</style>