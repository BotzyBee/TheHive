<script>
  import { invoke } from '@tauri-apps/api/core';
  import { tick } from 'svelte';
  import { open } from '@tauri-apps/plugin-dialog';

  let inputValue = "";
  let menuOpen = false;
  let filteredOptions = [];
  let selectedIndex = 0;
  let inputRef;

  // Static list for tools
  const toolList = [
    { label: 'Git', icon: '🌲', type: 'tool' },
    { label: 'Node.js', icon: '🟢', type: 'tool' },
    { label: 'Rustc', icon: '🦀', type: 'tool' }
  ];

  async function handleInput(e) {
    const cursor = e.target.selectionStart;
    const textBeforeCursor = inputValue.slice(0, cursor);
    const words = textBeforeCursor.split(/\s/);
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("/")) {
      const query = lastWord.slice(1).toLowerCase();
      
      // 1. Initial Categories
      let options = [
        { label: 'folder', icon: '📁', type: 'cmd' },
        { label: 'file', icon: '📄', type: 'cmd' },
        ...toolList
      ];

      // 2. If user typed "/folder " or similar, we could trigger Rust here
      // For this example, we filter the initial command list
      filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(query)
      );

      menuOpen = filteredOptions.length > 0;
    } else {
      menuOpen = false;
    }
  }

  async function selectOption(option) {
    const cursor = inputRef.selectionStart;
    const textBeforeCursor = inputValue.slice(0, cursor);
    const textAfterCursor = inputValue.slice(cursor);
    const words = textBeforeCursor.split(/\s/);

    if (option.label === 'folder' || option.label === 'file') {
      // Trigger a native Tauri dialog for better UX than a manual text list
      try {
        const selected = await open({
          directory: option.label === 'folder',
          multiple: false,
          defaultPath: import.meta.env.VITE_KNOWLEDGEBASE_PATH
        });
        
        if (selected) {
            // Get relative path
            let selectedPath = selected.replace(/\\/g, '/');
            const basePath = import.meta.env.VITE_KNOWLEDGEBASE_PATH.replace(/\\/g, '/');
            const base = new URL(`file:///${basePath}/`);
            const target = new URL(`file:///${selectedPath}`);
            let relative = target.pathname.replace(base.pathname, '');
            // Ensure leading slash
            if (!relative.startsWith('/')) {
            relative = '/' + relative;
            }
            words[words.length - 1] = relative;
        }
      } catch (err) {
        console.error("Dialog error:", err);
      }
    } else {
      // It's a tool or a specific command
      words[words.length - 1] = `[${option.label}]`;
    }

    inputValue = words.join(" ") + textAfterCursor;
    menuOpen = false;
    
    await tick();
    inputRef.focus();
  }

  function handleKeyDown(e) {
    if (!menuOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredOptions.length;
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredOptions.length) % filteredOptions.length;
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectOption(filteredOptions[selectedIndex]);
    }
  }
</script>

<main class="container">
  <h1>Tauri Command Input</h1>
  
  <div class="input-container">
    <input
      bind:this={inputRef}
      bind:value={inputValue}
      on:input={handleInput}
      on:keydown={handleKeyDown}
      placeholder="Type / to begin..."
    />

    {#if menuOpen}
      <ul class="dropdown">
        {#each filteredOptions as opt, i}
          <li class:active={i === selectedIndex} on:mousedown={() => selectOption(opt)}>
            <span class="icon">{opt.icon}</span>
            <span class="label">{opt.label}</span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</main>

<style>
  .container { padding: 2rem; font-family: system-ui; }
  .input-container { position: relative; max-width: 600px; }
  
  input {
    width: 100%;
    padding: 1rem;
    background: #1a1a1a;
    color: white;
    border: 1px solid #333;
    border-radius: 8px;
    font-size: 1rem;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #222;
    border: 1px solid #444;
    border-radius: 8px;
    margin-top: 8px;
    list-style: none;
    padding: 0;
    overflow: hidden;
  }

  .dropdown li {
    padding: 0.75rem 1rem;
    display: flex;
    gap: 12px;
    cursor: pointer;
    color: #ccc;
  }

  .dropdown li.active {
    background: #333;
    color: white;
  }

  .icon { opacity: 0.7; }
</style>