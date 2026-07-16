
function togglePlan(button) {
    // Close other open plans
    const allButtons = document.querySelectorAll('.plan-button');
    const allPackages = document.querySelectorAll('.packages');

    allButtons.forEach(btn => {
        if (btn !== button) {
            btn.classList.remove('active');
        }
    });

    allPackages.forEach(pkg => {
        if (pkg.previousElementSibling !== button) {
            pkg.classList.remove('active');
        }
    });

    // Toggle current plan
    button.classList.toggle('active');
    button.nextElementSibling.classList.toggle('active');
}

async function selectPackage(plan, package_type) {
    alert('Voucher payments are disabled for now. Please contact an administrator to generate a voucher.');
}
