<div class="flex flex-col min-h-screen w-full overflow-x-hidden">
    <header>
        <slot name="head"/>
    </header>
    <main class="flex-grow">
        <slot name="body"/>
    </main>
    <footer>
        <slot name="foot"/>
    </footer>
</div>