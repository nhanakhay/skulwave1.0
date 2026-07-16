const apiBase = `http://${window.location.hostname}:3000/api`;
const packageSelect = document.getElementById('packageSelect');
const adminUsernameLabel = document.getElementById('adminUsername');
const generatedList = document.getElementById('generatedList');
const generatedOutput = document.getElementById('generatedOutput');
const generateBtn = document.getElementById('generateBtn');
const generateLoading = document.getElementById('generateLoading');

const adminApiKey = localStorage.getItem('adminApiKey');
const adminUsername = localStorage.getItem('adminUsername');

if (!adminApiKey || !adminUsername) {
    window.location.href = 'adminlogin.html';
}

adminUsernameLabel.textContent = adminUsername;

async function loadPackages() {
    try {
        const response = await fetch(`${apiBase}/admin/packages`, {
            headers: {
                'Content-Type': 'application/json',
                'x-admin-key': adminApiKey,
            },
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Unable to load packages');
        }
        packageSelect.innerHTML = data.packages
            .map((pkg) => `<option value="${pkg.id}">${pkg.name} (${pkg.speed})</option>`)
            .join('');
    } catch (err) {
        console.error(err);
        alert('Unable to load voucher profiles.');
    }
}

function makeRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

async function handleGenerateVouchers(event) {
    event.preventDefault();

    const packageId = document.voucherGenerator.package_id.value;
    const count = Number(document.voucherGenerator.count.value) || 1;
    const usernamePrefix = document.voucherGenerator.usernamePrefix.value.trim() || 'voucher';
    const passwordTemplate = document.voucherGenerator.passwordTemplate.value.trim() || 'pass';

    if (count < 1) {
        alert('Please enter a valid voucher count.');
        return false;
    }

    generateBtn.disabled = true;
    generateLoading.style.display = 'block';

    const results = [];

    for (let i = 0; i < count; i++) {
        const voucherUsername = `${usernamePrefix}-${Date.now().toString().slice(-5)}-${i + 1}`;
        const voucherPassword = `${passwordTemplate}-${makeRandomString(6)}`;

        try {
            const response = await fetch(`${apiBase}/vouchers/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminApiKey,
                },
                body: JSON.stringify({
                    package_id: packageId,
                    hotspot_username: voucherUsername,
                    hotspot_password: voucherPassword,
                    created_by: adminUsername,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create voucher');
            }
            results.push(`${voucherUsername}:${voucherPassword} (${data.voucher.package_name})`);
        } catch (err) {
            console.error(err);
            results.push(`ERROR: ${err.message} for ${voucherUsername}`);
        }
    }

    generatedOutput.textContent = results.join('\n');
    generatedList.style.display = 'block';
    generateBtn.disabled = false;
    generateLoading.style.display = 'none';
    return false;
}

function logoutAdmin() {
    localStorage.removeItem('adminApiKey');
    localStorage.removeItem('adminUsername');
    window.location.href = 'adminlogin.html';
}

loadPackages();
