let packageSelect;
let generatedOutput;
let generateBtn;

const adminApiKey = localStorage.getItem('adminApiKey');
const adminUsername = localStorage.getItem('adminUsername');

if (!adminApiKey || !adminUsername) {
    window.location.href = '../admin/adminlogin.html';
}

document.getElementById('adminContent').innerHTML = `<h2>Generate vouchers</h2><p class="lede">Create single-use Wi-Fi access vouchers for a package.</p><div class="panel form-card"><form name="voucherGenerator"><div class="form-grid"><label>Voucher profile<select name="package_id" id="packageSelect"></select></label><label>Quantity<input name="count" type="number" min="1" max="100" value="1"></label></div><p class="lede" style="margin:16px 0">Each voucher uses the shared hotspot password configured on the server.</p><button type="submit" id="generateBtn" class="primary-button">Generate vouchers</button></form><div id="generatedList" style="display:none;margin-top:24px"><h3>Generated vouchers</h3><div id="generatedOutput" class="generated-output"></div></div></div>`;
packageSelect = document.getElementById('packageSelect');
generatedOutput = document.getElementById('generatedOutput');
generateBtn = document.getElementById('generateBtn');
document.voucherGenerator.addEventListener('submit', handleGenerateVouchers);

async function loadPackages() {
    try {
        const data = await adminApi.get('/packages');
        packageSelect.innerHTML = data.packages
            .map((pkg) => `<option value="${pkg.id}">${pkg.name} (${pkg.speed})</option>`)
            .join('');
    } catch (err) {
        console.error(err);
        alert('Unable to load voucher profiles.');
    }
}

async function handleGenerateVouchers(event) {
    event.preventDefault();

    const packageId = document.voucherGenerator.package_id.value;
    const count = Number(document.voucherGenerator.count.value) || 1;

    if (count < 1) {
        alert('Please enter a valid voucher count.');
        return false;
    }

    generateBtn.disabled = true;

    const results = [];

    for (let i = 0; i < count; i++) {
        try {
            const response = await fetch('/api/vouchers/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-admin-key': adminApiKey,
                },
                body: JSON.stringify({
                    package_id: packageId,
                    created_by: adminUsername,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create voucher');
            }
            const voucherUsername = data.voucher?.hotspot_username || 'unknown';
            results.push(`${voucherUsername}:skulwave (${data.voucher.package_name})`);
        } catch (err) {
            console.error(err);
            results.push(`ERROR: ${err.message}`);
        }
    }

    generatedOutput.textContent = results.join('\n');
    console.log(results);
    document.getElementById('generatedList').style.display = 'block';
    generateBtn.disabled = false;
    return false;
}

loadPackages();
