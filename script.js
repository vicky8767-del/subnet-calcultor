(() => {
    // Utility functions
    function ipToInt(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    }

    function intToIp(int) {
        return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
    }

    function isValidIp(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        return parts.every(part => {
            const n = Number(part);
            return n >= 0 && n <= 255 && part === n.toString();
        });
    }

    function cidrToMask(cidr) {
        return intToIp(~((1 << (32 - cidr)) - 1) >>> 0);
    }

    function maskToCidr(mask) {
        if (!isValidIp(mask)) return -1;
        const binaryStr = mask.split('.').map(octet => parseInt(octet, 10).toString(2).padStart(8, '0')).join('');
        const firstZero = binaryStr.indexOf('0');
        if (firstZero === -1) return 32;
        if (binaryStr.slice(firstZero).includes('1')) return -1; // invalid mask
        return firstZero;
    }

    function wildcardMask(mask) {
        return mask.split('.').map(octet => 255 - parseInt(octet, 10)).join('.');
    }

    function getIpClass(ip) {
        const firstOctet = parseInt(ip.split('.')[0], 10);
        if (firstOctet >= 1 && firstOctet <= 126) return 'A';
        if (firstOctet >= 128 && firstOctet <= 191) return 'B';
        if (firstOctet >= 192 && firstOctet <= 223) return 'C';
        if (firstOctet >= 224 && firstOctet <= 239) return 'D (Multicast)';
        if (firstOctet >= 240 && firstOctet <= 254) return 'E (Experimental)';
        return 'Unknown';
    }

    function getIpType(ip) {
        const intIp = ipToInt(ip);
        // Private ranges
        if (intIp >= ipToInt('10.0.0.0') && intIp <= ipToInt('10.255.255.255')) return 'Private';
        if (intIp >= ipToInt('172.16.0.0') && intIp <= ipToInt('172.31.255.255')) return 'Private';
        if (intIp >= ipToInt('192.168.0.0') && intIp <= ipToInt('192.168.255.255')) return 'Private';
        // Loopback
        if (intIp >= ipToInt('127.0.0.0') && intIp <= ipToInt('127.255.255.255')) return 'Loopback';
        // Link-local
        if (intIp >= ipToInt('169.254.0.0') && intIp <= ipToInt('169.254.255.255')) return 'Link-local';
        // Multicast (Class D)
        if (intIp >= ipToInt('224.0.0.0') && intIp <= ipToInt('239.255.255.255')) return 'Private';
        // Reserved (Class E)
        if (intIp >= ipToInt('240.0.0.0') && intIp <= ipToInt('255.255.255.254')) return 'Private';
        return 'Public';
    }

    function calculateSubnet(ip, maskInput) {
        let mask, cidr;

        if (maskInput.startsWith('/')) {
            cidr = parseInt(maskInput.slice(1), 10);
            if (isNaN(cidr) || cidr < 0 || cidr > 32) return null;
            mask = cidrToMask(cidr);
        } else {
            if (!isValidIp(maskInput)) return null;
            mask = maskInput;
            cidr = maskToCidr(mask);
            if (cidr === -1) return null;
        }

        const ipInt = ipToInt(ip);
        const maskInt = ipToInt(mask);
        const networkInt = ipInt & maskInt;
        const broadcastInt = networkInt | (~maskInt >>> 0);

        const firstHostInt = networkInt + 1;
        const lastHostInt = broadcastInt - 1;
        const totalHosts = Math.pow(2, 32 - cidr);
        const usableHosts = totalHosts > 2 ? totalHosts - 2 : totalHosts;

        return {
            networkId: intToIp(networkInt),
            broadcast: intToIp(broadcastInt),
            firstHost: totalHosts > 2 ? intToIp(firstHostInt) : '-',
            lastHost: totalHosts > 2 ? intToIp(lastHostInt) : '-',
            totalHosts,
            usableHosts,
            subnetMask: mask,
            cidr,
            wildcardMask: wildcardMask(mask),
            ipClass: getIpClass(ip),
            ipType: getIpType(ip),
            binaryIp: ip.split('.').map(octet => parseInt(octet, 10).toString(2).padStart(8, '0')).join('.'),
            binaryMask: mask.split('.').map(octet => parseInt(octet, 10).toString(2).padStart(8, '0')).join('.')
        };
    }

    function calculateSubnetFromHosts(requiredHosts) {
        if (requiredHosts < 1) return null;

        // Calculate minimum CIDR needed for required hosts
        // For usable hosts, we need: 2^(32-cidr) - 2 >= requiredHosts
        // So: 2^(32-cidr) >= requiredHosts + 2
        // 32-cidr >= log2(requiredHosts + 2)
        // cidr <= 32 - log2(requiredHosts + 2)

        const minHostsNeeded = requiredHosts + 2; // +2 for network and broadcast
        const minCidr = Math.ceil(32 - Math.log2(minHostsNeeded));

        // Ensure CIDR is within valid range
        const cidr = Math.max(1, Math.min(32, minCidr));

        // Calculate subnet details
        const totalHosts = Math.pow(2, 32 - cidr);
        const usableHosts = totalHosts > 2 ? totalHosts - 2 : totalHosts;
        const subnetMask = cidrToMask(cidr);
        const wMask = wildcardMask(subnetMask);

        // Generate subnet suggestions
        const suggestions = [];

        // Conservative (exact fit)
        suggestions.push({
            name: 'Conservative',
            cidr: cidr,
            subnetMask: subnetMask,
            totalHosts: totalHosts,
            usableHosts: usableHosts,
            efficiency: Math.round((requiredHosts / usableHosts) * 100),
            waste: usableHosts - requiredHosts
        });

        // Recommended (next larger subnet for growth)
        const recommendedCidr = Math.max(1, cidr - 1);
        const recommendedTotalHosts = Math.pow(2, 32 - recommendedCidr);
        const recommendedUsableHosts = recommendedTotalHosts > 2 ? recommendedTotalHosts - 2 : recommendedTotalHosts;
        suggestions.push({
            name: 'Recommended',
            cidr: recommendedCidr,
            subnetMask: cidrToMask(recommendedCidr),
            totalHosts: recommendedTotalHosts,
            usableHosts: recommendedUsableHosts,
            efficiency: Math.round((requiredHosts / recommendedUsableHosts) * 100),
            waste: recommendedUsableHosts - requiredHosts
        });

        // Generous (for future growth)
        const generousCidr = Math.max(1, cidr - 2);
        const generousTotalHosts = Math.pow(2, 32 - generousCidr);
        const generousUsableHosts = generousTotalHosts > 2 ? generousTotalHosts - 2 : generousTotalHosts;
        suggestions.push({
            name: 'Generous',
            cidr: generousCidr,
            subnetMask: cidrToMask(generousCidr),
            totalHosts: generousTotalHosts,
            usableHosts: generousUsableHosts,
            efficiency: Math.round((requiredHosts / generousUsableHosts) * 100),
            waste: generousUsableHosts - requiredHosts
        });

        return {
            requiredHosts,
            suggestions,
            minCidr,
            maxEfficiency: Math.max(...suggestions.map(s => s.efficiency))
        };
    }

    function displayResults(results) {
        if (!results) {
            alert('Invalid IP address or subnet mask/CIDR.');
            return;
        }
        document.getElementById('network-id').textContent = results.networkId;
        document.getElementById('broadcast').textContent = results.broadcast;
        document.getElementById('host-range').textContent = results.firstHost + ' - ' + results.lastHost;
        document.getElementById('total-hosts').textContent = results.totalHosts;
        document.getElementById('usable-hosts').textContent = results.usableHosts;
        document.getElementById('subnet-mask-result').textContent = results.subnetMask;
        document.getElementById('cidr-notation').textContent = '/' + results.cidr;
        document.getElementById('wildcard-mask').textContent = results.wildcardMask;
        document.getElementById('ip-class').textContent = results.ipClass;
        document.getElementById('ip-type').textContent = results.ipType;
        document.getElementById('binary-display').textContent =
            `IP: ${results.binaryIp}\nMask: ${results.binaryMask}`;
    }

    function exportToCSV() {
        const results = {
            'IP Address': document.getElementById('ip-address').value,
            'Subnet Mask': document.getElementById('subnet-mask').value,
            'Required Hosts': document.getElementById('required-hosts').value,
            'Network ID': document.getElementById('network-id').textContent,
            'Broadcast Address': document.getElementById('broadcast').textContent,
            'Host Range': document.getElementById('host-range').textContent,
            'Total Hosts': document.getElementById('total-hosts').textContent,
            'Usable Hosts': document.getElementById('usable-hosts').textContent,
            'CIDR Notation': document.getElementById('cidr-notation').textContent,
            'Wildcard Mask': document.getElementById('wildcard-mask').textContent,
            'IP Class': document.getElementById('ip-class').textContent,
            'IP Type': document.getElementById('ip-type').textContent
        };

        const csvContent = 'data:text/csv;charset=utf-8,' +
            Object.keys(results).join(',') + '\n' +
            Object.values(results).map(value => `"${value}"`).join(',');

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', 'subnet_calculation.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    function displaySubnetSuggestions(suggestionsData) {
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
            <h3>📊 Subnet Suggestions for ${suggestionsData.requiredHosts} Hosts</h3>
            <p>Choose the best subnet size for your network requirements</p>
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
                    <span class="cidr-badge">/${suggestion.cidr}</span>
                </div>
                <div class="suggestion-details">
                    <div class="detail-row">
                        <span class="label">Subnet Mask:</span>
                        <span class="value">${suggestion.subnetMask}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Usable Hosts:</span>
                        <span class="value">${suggestion.usableHosts}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Efficiency:</span>
                        <span class="value efficiency-${getEfficiencyClass(suggestion.efficiency)}">${suggestion.efficiency}%</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Waste:</span>
                        <span class="value">${suggestion.waste} hosts</span>
                    </div>
                </div>
                <button class="use-suggestion-btn" data-cidr="${suggestion.cidr}" data-mask="${suggestion.subnetMask}">
                    Use This Subnet
                </button>
            `;

            // Add click handler for the "Use This Subnet" button
            const useBtn = card.querySelector('.use-suggestion-btn');
            useBtn.addEventListener('click', () => {
                const ipInput = document.getElementById('ip-address');
                const maskInput = document.getElementById('subnet-mask');

                // If no IP is set, suggest a default based on class
                if (!ipInput.value.trim()) {
                    const defaultIp = getDefaultIpForClass(suggestion.cidr);
                    ipInput.value = defaultIp;
                }

                maskInput.value = `/${suggestion.cidr}`;
                document.getElementById('subnet-form').dispatchEvent(new Event('submit'));
            });

            suggestionsGrid.appendChild(card);
        });

        container.appendChild(suggestionsGrid);
    }

    function getEfficiencyClass(efficiency) {
        if (efficiency >= 80) return 'excellent';
        if (efficiency >= 60) return 'good';
        if (efficiency >= 40) return 'fair';
        return 'poor';
    }

    function getDefaultIpForClass(cidr) {
        // Suggest appropriate IP based on CIDR for common use cases
        if (cidr <= 8) return '10.0.0.0';        // Class A private
        if (cidr <= 16) return '172.16.0.0';     // Class B private
        if (cidr <= 24) return '192.168.0.0';    // Class C private
        return '192.168.1.0';                    // Default for smaller subnets
    }



    function generateRandomIp() {
        // Generate random class A, B, or C IP for practice
        const classes = ['A', 'B', 'C'];
        const cls = classes[Math.floor(Math.random() * classes.length)];
        let ip = '';
        switch (cls) {
            case 'A':
                ip = `${Math.floor(Math.random() * 126) + 1}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
                break;
            case 'B':
                ip = `${Math.floor(Math.random() * (191 - 128 + 1)) + 128}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
                break;
            case 'C':
                ip = `${Math.floor(Math.random() * (223 - 192 + 1)) + 192}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
                break;
        }
        const cidr = Math.floor(Math.random() * 16) + 16; // /16 to /31
        return { ip, cidr };
    }

    // Event listeners
    document.getElementById('subnet-form').addEventListener('submit', e => {
        e.preventDefault();
        const ip = document.getElementById('ip-address').value.trim();
        const maskInput = document.getElementById('subnet-mask').value.trim();
        const requiredHostsInput = document.getElementById('required-hosts').value.trim();
        const requiredHosts = requiredHostsInput ? parseInt(requiredHostsInput, 10) : null;

        // If only required hosts is provided, calculate for recommended subnet and show suggestions
        if (!ip && !maskInput && requiredHosts && requiredHosts > 0) {
            const suggestionsData = calculateSubnetFromHosts(requiredHosts);
            const recommended = suggestionsData.suggestions[1]; // Recommended
            const defaultIp = getDefaultIpForClass(recommended.cidr);
            document.getElementById('ip-address').value = defaultIp;
            document.getElementById('subnet-mask').value = `/${recommended.cidr}`;
            const results = calculateSubnet(defaultIp, `/${recommended.cidr}`);
            displayResults(results);
            displaySubnetSuggestions(suggestionsData);
            return;
        }

        // If IP and mask are provided, calculate normally
        if (ip && maskInput) {
            if (!isValidIp(ip)) {
                alert('Invalid IP format');
                return;
            }
            const results = calculateSubnet(ip, maskInput);
            if (!results) {
                alert('Subnet mask must be between /1 and /30');
                return;
            }
            displayResults(results);

            // Also show suggestions if required hosts is provided
            if (requiredHosts && requiredHosts > 0) {
                const suggestionsData = calculateSubnetFromHosts(requiredHosts);
                displaySubnetSuggestions(suggestionsData);
            }
        } else if (requiredHosts && requiredHosts > 0) {
            // Show suggestions for required hosts
            const suggestionsData = calculateSubnetFromHosts(requiredHosts);
            displaySubnetSuggestions(suggestionsData);
        } else {
            alert('Please provide either IP address with subnet mask, or required number of hosts.');
        }
    });

    document.getElementById('random-practice').addEventListener('click', () => {
        const { ip, cidr } = generateRandomIp();
        document.getElementById('ip-address').value = ip;
        document.getElementById('subnet-mask').value = '/' + cidr;
        document.getElementById('subnet-form').dispatchEvent(new Event('submit'));
    });

    document.getElementById('export-csv').addEventListener('click', exportToCSV);

    function exportToPDF() {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        const ip = document.getElementById('ip-address').value;
        const mask = document.getElementById('subnet-mask').value;
        const requiredHosts = document.getElementById('required-hosts').value;
        const networkId = document.getElementById('network-id').textContent;
        const broadcast = document.getElementById('broadcast').textContent;
        const hostRange = document.getElementById('host-range').textContent;
        const totalHosts = document.getElementById('total-hosts').textContent;
        const usableHosts = document.getElementById('usable-hosts').textContent;
        const cidr = document.getElementById('cidr-notation').textContent;
        const wildcard = document.getElementById('wildcard-mask').textContent;
        const ipClass = document.getElementById('ip-class').textContent;
        const ipType = document.getElementById('ip-type').textContent;

        doc.text('CCNA Subnet Calculator Results', 10, 10);
        doc.text(`IP Address: ${ip}`, 10, 20);
        doc.text(`Subnet Mask: ${mask}`, 10, 30);
        doc.text(`Required Hosts: ${requiredHosts}`, 10, 40);
        doc.text(`Network ID: ${networkId}`, 10, 50);
        doc.text(`Broadcast Address: ${broadcast}`, 10, 60);
        doc.text(`Host Range: ${hostRange}`, 10, 70);
        doc.text(`Total Hosts: ${totalHosts}`, 10, 80);
        doc.text(`Usable Hosts: ${usableHosts}`, 10, 90);
        doc.text(`CIDR Notation: ${cidr}`, 10, 100);
        doc.text(`Wildcard Mask: ${wildcard}`, 10, 110);
        doc.text(`IP Class: ${ipClass}`, 10, 120);
        doc.text(`IP Type: ${ipType}`, 10, 130);

        doc.save('subnet_calculation.pdf');
    }

    document.getElementById('export-pdf').addEventListener('click', exportToPDF);
})();
