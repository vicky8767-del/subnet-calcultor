(() => {
    // Utility functions for IPv6
    function expandIPv6(ip) {
        // Expand IPv6 address to full form
        if (ip.includes('::')) {
            const parts = ip.split('::');
            const left = parts[0].split(':').filter(p => p);
            const right = parts[1].split(':').filter(p => p);
            const missing = 8 - left.length - right.length;
            const zeros = Array(missing).fill('0000');
            const full = [...left, ...zeros, ...right];
            return full.map(p => p.padStart(4, '0')).join(':');
        }
        return ip.split(':').map(p => p.padStart(4, '0')).join(':');
    }

    function compressIPv6(ip) {
        // Compress IPv6 address
        return ip.replace(/(:0000)+/, '::').replace(/:::+/, '::');
    }

    function ipv6ToBinary(ip) {
        return expandIPv6(ip).split(':').map(h => parseInt(h, 16).toString(2).padStart(16, '0')).join('');
    }

    function binaryToIPv6(binary) {
        const groups = [];
        for (let i = 0; i < 128; i += 16) {
            groups.push(parseInt(binary.slice(i, i + 16), 2).toString(16).padStart(4, '0'));
        }
        return compressIPv6(groups.join(':'));
    }

    function isValidIPv6(ip) {
        const expanded = expandIPv6(ip);
        const parts = expanded.split(':');
        if (parts.length !== 8) return false;
        return parts.every(p => /^[0-9a-fA-F]{4}$/.test(p));
    }

    function calculateIPv6Subnet(ip, prefix) {
        if (!isValidIPv6(ip)) return null;
        const prefixNum = parseInt(prefix.slice(1), 10);
        if (isNaN(prefixNum) || prefixNum < 0 || prefixNum > 128) return null;

        const binary = ipv6ToBinary(ip);
        const networkBinary = binary.slice(0, prefixNum) + '0'.repeat(128 - prefixNum);
        const networkId = binaryToIPv6(networkBinary);

        const totalAddresses = BigInt(2) ** BigInt(128 - prefixNum);
        const usableAddresses = totalAddresses; // IPv6 does not have broadcast, all addresses usable

        // Host range: network to network + totalAddresses - 1
        const firstHost = networkId;
        const lastHostBinary = (BigInt('0b' + networkBinary) + totalAddresses - BigInt(1)).toString(2).padStart(128, '0');
        const lastHost = binaryToIPv6(lastHostBinary);

        const ipType = getIPv6Type(ip);

        return {
            networkId,
            prefix: prefixNum,
            firstHost,
            lastHost,
            totalAddresses: totalAddresses.toString(),
            usableAddresses: usableAddresses.toString(),
            ipType,
            binaryIp: binary,
            binaryNetwork: networkBinary
        };
    }

    function getIPv6Type(ip) {
        const expanded = expandIPv6(ip);
        if (expanded.startsWith('fe80')) return 'Link-local';
        if (expanded.startsWith('fc00') || expanded.startsWith('fd00')) return 'Unique Local';
        if (expanded.startsWith('2001:db8')) return 'Documentation';
        if (expanded.startsWith('2001:') || expanded.startsWith('2002:')) return 'Global Unicast';
        if (expanded.startsWith('::1')) return 'Loopback';
        if (expanded.startsWith('ff')) return 'Multicast';
        return 'Global Unicast';
    }

    function calculateIPv6FromSubnets(requiredSubnets) {
        if (requiredSubnets < 1) return null;

    // Calculate minimum prefix needed
    const minPrefix = Math.floor(128 - Math.log2(requiredSubnets));

        const suggestions = [];

        // Conservative
        suggestions.push({
            name: 'Conservative',
            prefix: minPrefix,
            totalSubnets: Math.pow(2, 128 - minPrefix),
            efficiency: Math.round((requiredSubnets / Math.pow(2, 128 - minPrefix)) * 100)
        });

        // Recommended
        const recommendedPrefix = Math.max(1, minPrefix - 4);
        suggestions.push({
            name: 'Recommended',
            prefix: recommendedPrefix,
            totalSubnets: Math.pow(2, 128 - recommendedPrefix),
            efficiency: Math.round((requiredSubnets / Math.pow(2, 128 - recommendedPrefix)) * 100)
        });

        // Generous
        const generousPrefix = Math.max(1, minPrefix - 8);
        suggestions.push({
            name: 'Generous',
            prefix: generousPrefix,
            totalSubnets: Math.pow(2, 128 - generousPrefix),
            efficiency: Math.round((requiredSubnets / Math.pow(2, 128 - generousPrefix)) * 100)
        });

        return {
            requiredSubnets,
            suggestions
        };
    }

    function displayIPv6Results(results) {
        if (!results) {
            alert('Invalid IPv6 address or prefix.');
            return;
        }
        document.getElementById('network-id').textContent = results.networkId;
        document.getElementById('prefix-length').textContent = '/' + results.prefix;
        document.getElementById('host-range').textContent = results.firstHost + ' - ' + results.lastHost;
        document.getElementById('total-addresses').textContent = results.totalAddresses;
        document.getElementById('usable-addresses').textContent = results.usableAddresses;
        document.getElementById('ip-type').textContent = results.ipType;
        document.getElementById('binary-display').textContent =
            `IP: ${results.binaryIp}\nNetwork: ${results.binaryNetwork}`;
    }

    function displayIPv6Suggestions(suggestionsData) {
        const container = document.getElementById('subnet-suggestions');
        if (!container) return;

        container.innerHTML = '';

        if (!suggestionsData) {
            container.innerHTML = '<p class="no-suggestions">No suggestions available</p>';
            return;
        }

        const header = document.createElement('div');
        header.className = 'suggestions-header';
        header.innerHTML = `
            <h3>📊 Subnet Suggestions for ${suggestionsData.requiredSubnets} Subnets</h3>
            <p>Choose the best prefix size for your network requirements</p>
        `;
        container.appendChild(header);

        const suggestionsGrid = document.createElement('div');
        suggestionsGrid.className = 'suggestions-grid';

        suggestionsData.suggestions.forEach((suggestion, index) => {
            const card = document.createElement('div');
            card.className = `suggestion-card ${suggestion.name.toLowerCase()}`;
            card.innerHTML = `
                <div class="suggestion-header">
                    <h4>${suggestion.name}</h4>
                    <span class="cidr-badge">/${suggestion.prefix}</span>
                </div>
                <div class="suggestion-details">
                    <div class="detail-row">
                        <span class="label">Total Subnets:</span>
                        <span class="value">${suggestion.totalSubnets}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Efficiency:</span>
                        <span class="value">${suggestion.efficiency}%</span>
                    </div>
                </div>
                <button class="use-suggestion-btn" data-prefix="${suggestion.prefix}">
                    Use This Prefix
                </button>
            `;

            // Add click handler for the "Use This Prefix" button
            const useBtn = card.querySelector('.use-suggestion-btn');
            useBtn.addEventListener('click', () => {
                const ipInput = document.getElementById('ip-address');
                const prefixInput = document.getElementById('subnet-mask');

                // If no IP is set, suggest a default
                if (!ipInput.value.trim()) {
                    ipInput.value = '2001:db8::1'; // Default IPv6 address
                }

                prefixInput.value = '/' + suggestion.prefix;
                document.getElementById('subnet-form').dispatchEvent(new Event('submit'));
            });

            suggestionsGrid.appendChild(card);
        });

        container.appendChild(suggestionsGrid);
    }

    function exportIPv6ToCSV() {
        const results = {
            'IPv6 Address': document.getElementById('ip-address').value,
            'Prefix Length': document.getElementById('subnet-mask').value,
            'Required Subnets': document.getElementById('required-hosts').value,
            'Network ID': document.getElementById('network-id').textContent,
            'Host Range': document.getElementById('host-range').textContent,
            'Total Addresses': document.getElementById('total-addresses').textContent,
            'Usable Addresses': document.getElementById('usable-addresses').textContent,
            'IP Type': document.getElementById('ip-type').textContent
        };

        const csvContent = 'data:text/csv;charset=utf-8,' +
            Object.keys(results).join(',') + '\n' +
            Object.values(results).map(value => `"${value}"`).join(',');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'ipv6_calculation.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function exportIPv6ToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const ip = document.getElementById('ip-address').value;
        const prefix = document.getElementById('subnet-mask').value;
        const requiredSubnets = document.getElementById('required-hosts').value;
        const networkId = document.getElementById('network-id').textContent;
        const hostRange = document.getElementById('host-range').textContent;
        const totalAddresses = document.getElementById('total-addresses').textContent;
        const usableAddresses = document.getElementById('usable-addresses').textContent;
        const ipType = document.getElementById('ip-type').textContent;

        doc.text('IPv6 Subnet Calculator Results', 10, 10);
        doc.text(`IPv6 Address: ${ip}`, 10, 20);
        doc.text(`Prefix Length: ${prefix}`, 10, 30);
        doc.text(`Required Subnets: ${requiredSubnets}`, 10, 40);
        doc.text(`Network ID: ${networkId}`, 10, 50);
        doc.text(`Host Range: ${hostRange}`, 10, 60);
        doc.text(`Total Addresses: ${totalAddresses}`, 10, 70);
        doc.text(`Usable Addresses: ${usableAddresses}`, 10, 80);
        doc.text(`IP Type: ${ipType}`, 10, 90);

        doc.save('ipv6_calculation.pdf');
    }

    function generateRandomIPv6() {
        const groups = [];
        for (let i = 0; i < 8; i++) {
            groups.push(Math.floor(Math.random() * 65536).toString(16).padStart(4, '0'));
        }
        const ip = groups.join(':');
        const prefix = Math.floor(Math.random() * 64) + 16; // /16 to /79
        return { ip, prefix };
    }

    // Event listeners
    document.getElementById('subnet-form').addEventListener('submit', e => {
        e.preventDefault();
        const ip = document.getElementById('ip-address').value.trim();
        const prefixInput = document.getElementById('subnet-mask').value.trim();
        const requiredSubnetsInput = document.getElementById('required-hosts').value.trim();
        const requiredSubnets = requiredSubnetsInput ? parseInt(requiredSubnetsInput, 10) : null;

        // Clear previous results and suggestions
        document.getElementById('subnet-suggestions').innerHTML = '';
        // Clear results display
        document.getElementById('network-id').textContent = '-';
        document.getElementById('prefix-length').textContent = '-';
        document.getElementById('host-range').textContent = '-';
        document.getElementById('total-addresses').textContent = '-';
        document.getElementById('usable-addresses').textContent = '-';
        document.getElementById('ip-type').textContent = '-';
        document.getElementById('binary-display').textContent = '-';

        if (ip && prefixInput) {
            if (!isValidIPv6(ip)) {
                alert('Invalid IPv6 format');
                return;
            }
            const results = calculateIPv6Subnet(ip, prefixInput);
            if (!results) {
                alert('Invalid prefix length');
                return;
            }
            displayIPv6Results(results);
        } else if (requiredSubnets && requiredSubnets > 0) {
            // Show suggestions for required subnets
            const suggestionsData = calculateIPv6FromSubnets(requiredSubnets);
            displayIPv6Suggestions(suggestionsData);
        } else {
            alert('Please provide IPv6 address with prefix or required number of subnets.');
        }
    });

    document.getElementById('random-practice').addEventListener('click', () => {
        const { ip, prefix } = generateRandomIPv6();
        document.getElementById('ip-address').value = ip;
        document.getElementById('subnet-mask').value = '/' + prefix;
        document.getElementById('subnet-form').dispatchEvent(new Event('submit'));
    });

    document.getElementById('export-csv').addEventListener('click', exportIPv6ToCSV);
    document.getElementById('export-pdf').addEventListener('click', exportIPv6ToPDF);
})();
