document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.app !== 'demo-portal') {
        return;
    }

    const buttons = document.querySelectorAll('[data-demo-tab]');
    const panels = document.querySelectorAll('[data-demo-panel]');

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            const target = button.dataset.demoTab;
            buttons.forEach((item) => item.classList.toggle('active', item === button));
            panels.forEach((panel) => panel.classList.toggle('active', panel.dataset.demoPanel === target));
        });
    });
});
