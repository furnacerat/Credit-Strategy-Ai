(() => {
  const form = document.getElementById('contactForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    // Placeholder: wire to email provider / API later.
    const note = document.getElementById('formNote');
    if (note) note.textContent = 'Thanks! We will reply shortly.';
    form.reset();
  });
})();
