(() => {
    // Utility functions - fallback if not loaded from main script
    function ipToInt(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
    }

    function intToIp(int) {
        return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
    }

    function isValidIp(ip) {
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        return parts.every(part => {
            const num = parseInt(part);
            return !isNaN(num) && num >= 0 && num <= 255;
        });
    }

    function cidrToMask(cidr) {
        const mask = (0xffffffff << (32 - cidr)) >>> 0;
        return intToIp(mask);
    }

    function maskToCidr(mask) {
        const maskInt = ipToInt(mask);
        let cidr = 0;
        let temp = maskInt;
        while (temp & 1) {
            cidr++;
            temp >>= 1;
        }
        return cidr;
    }

    function wildcardMask(mask) {
        const maskInt = ipToInt(mask);
        const wildcard = (~maskInt >>> 0);
        return intToIp(wildcard);
    }

    function getIpClass(ip) {
        const firstOctet = parseInt(ip.split('.')[0]);
        if (firstOctet >= 1 && firstOctet <= 126) return 'A';
        if (firstOctet >= 128 && firstOctet <= 191) return 'B';
        if (firstOctet >= 192 && firstOctet <= 223) return 'C';
        if (firstOctet >= 224 && firstOctet <= 239) return 'D';
        if (firstOctet >= 240 && firstOctet <= 255) return 'E';
        return 'Unknown';
    }

    function getIpType(ip) {
        const firstOctet = parseInt(ip.split('.')[0]);
        if (firstOctet === 10) return 'Private';
        if (firstOctet === 172 && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31) return 'Private';
        if (firstOctet === 192 && parseInt(ip.split('.')[1]) === 168) return 'Private';
        if (firstOctet === 127) return 'Loopback';
        if (firstOctet >= 224 && firstOctet <= 239) return 'Multicast';
        if (firstOctet >= 240 && firstOctet <= 255) return 'Reserved';
        return 'Public';
    }

    function calculateSubnet(ip, maskInput) {
        if (!isValidIp(ip)) return null;

        let cidr;
        if (maskInput.startsWith('/')) {
            cidr = parseInt(maskInput.substring(1));
        } else if (isValidIp(maskInput)) {
            cidr = maskToCidr(maskInput);
        } else {
            return null;
        }

        if (isNaN(cidr) || cidr < 0 || cidr > 32) return null;

        const ipInt = ipToInt(ip);
        const mask = cidrToMask(cidr);
        const maskInt = ipToInt(mask);
        const networkInt = ipInt & maskInt;
        const broadcastInt = networkInt | (~maskInt >>> 0);
        const totalHosts = Math.pow(2, 32 - cidr);
        const usableHosts = totalHosts > 2 ? totalHosts - 2 : totalHosts;

        return {
            networkId: intToIp(networkInt),
            broadcast: intToIp(broadcastInt),
            firstHost: totalHosts > 2 ? intToIp(networkInt + 1) : intToIp(networkInt),
            lastHost: totalHosts > 2 ? intToIp(broadcastInt - 1) : intToIp(broadcastInt),
            subnetMask: mask,
            wildcardMask: wildcardMask(mask),
            cidr,
            totalHosts,
            usableHosts,
            ipClass: getIpClass(ip),
            ipType: getIpType(ip),
            binaryMask: Array.from({length: 32}, (_, i) => i < cidr ? '1' : '0').join('')
        };
    }

    // Use utilities from main script if available, otherwise use fallbacks
    const utils = window.subnetUtils || {
        ipToInt,
        intToIp,
        isValidIp,
        cidrToMask,
        maskToCidr,
        wildcardMask,
        getIpClass,
        getIpType,
        calculateSubnet
    };

    // Extract functions for use
    const {
        ipToInt: ipToIntUtil,
        intToIp: intToIpUtil,
        isValidIp: isValidIpUtil,
        cidrToMask: cidrToMaskUtil,
        maskToCidr: maskToCidrUtil,
        wildcardMask: wildcardMaskUtil,
        getIpClass: getIpClassUtil,
        getIpType: getIpTypeUtil,
        calculateSubnet: calculateSubnetUtil
    } = utils;

    // Utility function to add copy buttons to result values
    function addCopyButtons(container) {
        const valueElements = container.querySelectorAll('.value');
        valueElements.forEach(element => {
            if (element.querySelector('.copy-btn')) return; // Already has copy button

            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-btn';
            copyBtn.innerHTML = '📋';
            copyBtn.title = 'Copy to clipboard';
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(element.textContent.trim());
                    copyBtn.textContent = '✅';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy: ', err);
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = element.textContent.trim();
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    copyBtn.textContent = '✅';
                    copyBtn.classList.add('copied');
                    setTimeout(() => {
                        copyBtn.innerHTML = '📋';
                        copyBtn.classList.remove('copied');
                    }, 2000);
                }
            });
            element.appendChild(copyBtn);
        });
    }

    // Utility functions for advanced features
    function calculateSubnetFromSubnets(baseNetwork, requiredSubnets) {
        if (!isValidIp(baseNetwork) || requiredSubnets < 1) return null;

        // Find minimum CIDR that can accommodate required subnets
        const minCidr = Math.ceil(Math.log2(requiredSubnets));
        const cidr = Math.max(1, Math.min(32, 32 - minCidr));

        const baseInt = ipToIntUtil(baseNetwork);
        const mask = cidrToMaskUtil(cidr);
        const maskInt = ipToIntUtil(mask);
        const networkInt = baseInt & maskInt;

        const totalHosts = Math.pow(2, 32 - cidr);
        const usableHosts = totalHosts > 2 ? totalHosts - 2 : totalHosts;

        return {
            networkId: intToIpUtil(networkInt),
            subnetMask: mask,
            cidr,
            totalSubnets: Math.pow(2, minCidr),
            hostsPerSubnet: totalHosts,
            usableHostsPerSubnet: usableHosts,
            efficiency: Math.round((requiredSubnets / Math.pow(2, minCidr)) * 100)
        };
    }

    function summarizeRoutes(networks, options = {}) {
        if (!networks || networks.length === 0) return null;

        const {
            maxSummaries = 3,
            includeEfficiency = true,
            includeStepByStep = true,
            allowOverlapping = true
        } = options;

        // Parse and validate networks
        const parsedNetworks = networks.map(net => {
            const [ip, cidrStr] = net.split('/');
            const cidr = parseInt(cidrStr);
            if (!isValidIpUtil(ip) || isNaN(cidr) || cidr < 0 || cidr > 32) {
                throw new Error(`Invalid network: ${net}`);
            }
            const ipInt = ipToIntUtil(ip);
            const maskInt = ipToIntUtil(cidrToMaskUtil(cidr));
            const networkInt = ipInt & maskInt;
            const broadcastInt = networkInt | (~maskInt >>> 0);

            return {
                network: net,
                ip,
                cidr,
                ipInt,
                networkInt,
                broadcastInt,
                hostCount: Math.pow(2, 32 - cidr),
                usableHosts: Math.pow(2, 32 - cidr) > 2 ? Math.pow(2, 32 - cidr) - 2 : Math.pow(2, 32 - cidr)
            };
        });

        // Sort networks by network address
        parsedNetworks.sort((a, b) => a.networkInt - b.networkInt);

        // Remove duplicates and handle overlapping if enabled
        const uniqueNetworks = [];
        for (const net of parsedNetworks) {
            const overlapping = uniqueNetworks.find(existing =>
                net.networkInt >= existing.networkInt &&
                net.broadcastInt <= existing.broadcastInt
            );
            if (!overlapping) {
                uniqueNetworks.push(net);
            }
        }

        if (uniqueNetworks.length === 0) return null;

        // Calculate total address space covered
        const totalCoveredHosts = uniqueNetworks.reduce((sum, net) => sum + net.hostCount, 0);

        // Find overlapping regions to avoid double-counting
        let actualCoveredHosts = 0;
        if (allowOverlapping) {
            // Merge overlapping ranges
            const mergedRanges = [];
            for (const net of uniqueNetworks) {
                let merged = false;
                for (let i = 0; i < mergedRanges.length; i++) {
                    const range = mergedRanges[i];
                    if (net.networkInt <= range.end && net.broadcastInt >= range.start) {
                        // Overlapping or adjacent
                        range.start = Math.min(range.start, net.networkInt);
                        range.end = Math.max(range.end, net.broadcastInt);
                        merged = true;
                        break;
                    }
                }
                if (!merged) {
                    mergedRanges.push({
                        start: net.networkInt,
                        end: net.broadcastInt
                    });
                }
            }
            actualCoveredHosts = mergedRanges.reduce((sum, range) => sum + (range.end - range.start + 1), 0);
        } else {
            actualCoveredHosts = totalCoveredHosts;
        }

        // Generate multiple summary options
        const summaries = [];
        const minStart = Math.min(...uniqueNetworks.map(n => n.networkInt));
        const maxEnd = Math.max(...uniqueNetworks.map(n => n.broadcastInt));

        // Summary 1: Minimal supernet (most efficient)
        const totalRange = maxEnd - minStart + 1;
        const requiredBits = Math.ceil(Math.log2(totalRange));
        const minimalCidr = Math.max(0, 32 - requiredBits);
        const minimalMask = cidrToMaskUtil(minimalCidr);
        const minimalNetworkInt = minStart & ipToIntUtil(minimalMask);
        const minimalNetwork = intToIpUtil(minimalNetworkInt);
        const minimalHosts = Math.pow(2, 32 - minimalCidr);
        const minimalEfficiency = Math.round((actualCoveredHosts / minimalHosts) * 100);

        summaries.push({
            network: `${minimalNetwork}/${minimalCidr}`,
            mask: minimalMask,
            totalHosts: minimalHosts,
            coveredHosts: actualCoveredHosts,
            efficiency: minimalEfficiency,
            type: 'minimal',
            description: 'Most efficient - smallest possible supernet'
        });

        // Summary 2: Conservative approach (higher CIDR)
        const conservativeCidr = Math.min(24, minimalCidr + 2);
        if (conservativeCidr !== minimalCidr) {
            const conservativeMask = cidrToMaskUtil(conservativeCidr);
            const conservativeNetworkInt = minStart & ipToIntUtil(conservativeMask);
            const conservativeNetwork = intToIpUtil(conservativeNetworkInt);
            const conservativeHosts = Math.pow(2, 32 - conservativeCidr);
            const conservativeEfficiency = Math.round((actualCoveredHosts / conservativeHosts) * 100);

            summaries.push({
                network: `${conservativeNetwork}/${conservativeCidr}`,
                mask: conservativeMask,
                totalHosts: conservativeHosts,
                coveredHosts: actualCoveredHosts,
                efficiency: conservativeEfficiency,
                type: 'conservative',
                description: 'Conservative - slightly larger but more manageable'
            });
        }

        // Summary 3: Class-based approach
        const firstOctet = parseInt(uniqueNetworks[0].ip.split('.')[0]);
        let classCidr;
        if (firstOctet >= 192) classCidr = 24;
        else if (firstOctet >= 128) classCidr = 16;
        else classCidr = 8;

        if (classCidr > minimalCidr) {
            const classMask = cidrToMaskUtil(classCidr);
            const classNetworkInt = minStart & ipToIntUtil(classMask);
            const classNetwork = intToIpUtil(classNetworkInt);
            const classHosts = Math.pow(2, 32 - classCidr);
            const classEfficiency = Math.round((actualCoveredHosts / classHosts) * 100);

            summaries.push({
                network: `${classNetwork}/${classCidr}`,
                mask: classMask,
                totalHosts: classHosts,
                coveredHosts: actualCoveredHosts,
                efficiency: classEfficiency,
                type: 'class-based',
                description: 'Class-based - traditional network boundary'
            });
        }

        // Sort summaries by efficiency (highest first)
        summaries.sort((a, b) => b.efficiency - a.efficiency);

        // Generate step-by-step explanation
        const steps = includeStepByStep ? [
            `Parsed ${networks.length} input networks`,
            `Removed ${networks.length - uniqueNetworks.length} duplicate/overlapping networks`,
            `Total address space covered: ${actualCoveredHosts.toLocaleString()} hosts`,
            `Generated ${summaries.length} summary options`,
            `Best summary: ${summaries[0].network} (${summaries[0].efficiency}% efficient)`
        ] : null;

        return {
            inputNetworks: networks,
            parsedNetworks: uniqueNetworks,
            summaries: summaries.slice(0, maxSummaries),
            totalCoveredHosts: actualCoveredHosts,
            totalInputHosts: totalCoveredHosts,
            steps,
            statistics: {
                inputCount: networks.length,
                uniqueCount: uniqueNetworks.length,
                totalHostsCovered: actualCoveredHosts,
                addressRange: `${intToIpUtil(minStart)} - ${intToIpUtil(maxEnd)}`
            }
        };
    }

    function generateACLWildcard(network, mask) {
        const results = calculateSubnet(network, mask);
        if (!results) return null;

        return {
            network: results.networkId,
            wildcard: results.wildcardMask,
            aclCommand: `access-list 101 permit ip ${results.networkId} ${results.wildcardMask} any`,
            hostCommand: `access-list 101 permit ip host ${results.networkId} any`,
            description: `ACL wildcard for network ${results.networkId}/${results.cidr}`
        };
    }

    function generateStaticRoute(network, mask, nextHop) {
        const results = calculateSubnet(network, mask);
        if (!results) return null;

        return {
            routeCommand: `ip route ${results.networkId} ${results.subnetMask} ${nextHop}`,
            network: results.networkId,
            mask: results.subnetMask,
            nextHop,
            description: `Static route to ${results.networkId}/${results.cidr} via ${nextHop}`
        };
    }
    function switchTool(toolId) {
        // Hide all tool sections
        document.querySelectorAll('.tool-section').forEach(section => {
            section.classList.remove('active');
        });

        // Remove active class from all tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Show selected tool section
        document.getElementById(toolId + '-section').classList.add('active');

        // Add active class to selected button
        document.getElementById(toolId).classList.add('active');
    }

    // Initialize tool switching
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const toolId = btn.id;
            switchTool(toolId);
        });
    });

    // 1. Calculate Subnet from Required Subnets
    document.getElementById('subnet-from-subnets-form').addEventListener('submit', e => {
        e.preventDefault();
        const baseNetwork = document.getElementById('base-network').value.trim();
        const requiredSubnets = parseInt(document.getElementById('required-subnets').value);

        if (!isValidIp(baseNetwork) || isNaN(requiredSubnets) || requiredSubnets < 1) {
            alert('Please enter a valid IP address and number of subnets.');
            return;
        }

        // Calculate minimum CIDR needed for required subnets
        const minCidr = Math.ceil(Math.log2(requiredSubnets));
        const cidr = Math.max(1, Math.min(30, 32 - minCidr));

        const results = calculateSubnet(baseNetwork, `/${cidr}`);
        if (!results) {
            alert('Invalid calculation parameters.');
            return;
        }

        const container = document.getElementById('subnet-from-subnets-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>Subnet Configuration for ${requiredSubnets} Subnets</h3>
                <div class="result-item">
                    <strong>Base Network:</strong>
                    <span class="value">${baseNetwork}</span>
                </div>
                <div class="result-item">
                    <strong>Subnet Mask:</strong>
                    <span class="value">${results.subnetMask}</span>
                </div>
                <div class="result-item">
                    <strong>CIDR Notation:</strong>
                    <span class="value">/${results.cidr}</span>
                </div>
                <div class="result-item">
                    <strong>Hosts per Subnet:</strong>
                    <span class="value">${results.totalHosts}</span>
                </div>
                <div class="result-item">
                    <strong>Usable Hosts per Subnet:</strong>
                    <span class="value">${results.usableHosts}</span>
                </div>
                <div class="result-item">
                    <strong>Total Subnets Available:</strong>
                    <span class="value">${Math.pow(2, minCidr)}</span>
                </div>
                <div class="binary-highlight">
                    <strong>Binary Breakdown:</strong><br>
                    <span class="binary-network">${results.binaryMask.substring(0, results.cidr)}</span><span class="binary-host">${results.binaryMask.substring(results.cidr)}</span>
                </div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${Math.min(100, (requiredSubnets / Math.pow(2, minCidr)) * 100)}%"></div>
                        <div class="progress-text">${requiredSubnets}/${Math.pow(2, minCidr)} subnets used</div>
                    </div>
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 2. Route Summarization
    document.getElementById('route-summarization-form').addEventListener('submit', e => {
        e.preventDefault();
        const networksText = document.getElementById('networks-list').value.trim();
        const networks = networksText.split('\n').map(net => net.trim()).filter(net => net);

        if (networks.length < 2) {
            alert('Please enter at least 2 networks to summarize.');
            return;
        }

        try {
            // Use the enhanced summarizeRoutes function
            const result = summarizeRoutes(networks, {
                maxSummaries: 3,
                includeEfficiency: true,
                includeStepByStep: true,
                allowOverlapping: true
            });

            const container = document.getElementById('route-summarization-results');
            let html = `
                <div class="result-card">
                    <h3>Enhanced Route Summarization Results</h3>

                    <!-- Statistics Section -->
                    <div class="summary-stats">
                        <div class="stat-item">
                            <strong>Input Networks:</strong>
                            <span class="value">${result.statistics.inputCount}</span>
                        </div>
                        <div class="stat-item">
                            <strong>Unique Networks:</strong>
                            <span class="value">${result.statistics.uniqueCount}</span>
                        </div>
                        <div class="stat-item">
                            <strong>Address Range:</strong>
                            <span class="value">${result.statistics.addressRange}</span>
                        </div>
                        <div class="stat-item">
                            <strong>Total Hosts Covered:</strong>
                            <span class="value">${result.totalCoveredHosts.toLocaleString()}</span>
                        </div>
                    </div>

                    <!-- Step-by-step explanation -->
                    ${result.steps ? `
                        <div class="step-by-step">
                            <h4>Calculation Steps:</h4>
                            <ol>
                                ${result.steps.map(step => `<li>${step}</li>`).join('')}
                            </ol>
                        </div>
                    ` : ''}

                    <!-- Summary Options -->
                    <div class="summary-options">
                        <h4>Summary Options (Sorted by Efficiency):</h4>
                        ${result.summaries.map((summary, index) => `
                            <div class="summary-option ${index === 0 ? 'best-option' : ''}">
                                <h5>${index === 0 ? '🏆 Best Summary' : `Option ${index + 1}`}: ${summary.type}</h5>
                                <div class="result-item">
                                    <strong>Network:</strong>
                                    <span class="value">${summary.network}</span>
                                </div>
                                <div class="result-item">
                                    <strong>Subnet Mask:</strong>
                                    <span class="value">${summary.mask}</span>
                                </div>
                                <div class="result-item">
                                    <strong>Total Hosts:</strong>
                                    <span class="value">${summary.totalHosts.toLocaleString()}</span>
                                </div>
                                <div class="result-item">
                                    <strong>Efficiency:</strong>
                                    <span class="value ${summary.efficiency >= 80 ? 'high-efficiency' : summary.efficiency >= 50 ? 'medium-efficiency' : 'low-efficiency'}">${summary.efficiency}%</span>
                                </div>
                                <div class="result-item">
                                    <strong>Description:</strong>
                                    <span class="value">${summary.description}</span>
                                </div>
                                <div class="result-item">
                                    <strong>Static Route:</strong>
                                    <span class="value">ip route ${summary.network.split('/')[0]} ${summary.mask} [next-hop]</span>
                                </div>
                                <div class="result-item">
                                    <strong>OSPF Summary:</strong>
                                    <span class="value">area 0 range ${summary.network.split('/')[0]} ${summary.mask}</span>
                                </div>
                                ${summary.efficiency < 100 ? `
                                    <div class="efficiency-bar">
                                        <div class="efficiency-fill" style="width: ${summary.efficiency}%"></div>
                                        <div class="efficiency-text">${summary.efficiency}% efficient</div>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>

                    <!-- Original Networks List -->
                    <div class="original-networks">
                        <h4>Original Networks:</h4>
                        <div class="networks-list">
                            ${result.inputNetworks.map(net => `<span class="network-tag">${net}</span>`).join('')}
                        </div>
                    </div>

                    <!-- Additional Commands -->
                    <div class="additional-commands">
                        <h4>Configuration Commands:</h4>
                        <div class="command-group">
                            <h5>Cisco IOS Commands:</h5>
                            <div class="result-item">
                                <strong>Static Route:</strong>
                                <span class="value">ip route ${result.summaries[0].network.split('/')[0]} ${result.summaries[0].mask} [next-hop]</span>
                            </div>
                            <div class="result-item">
                                <strong>EIGRP Summary:</strong>
                                <span class="value">ip summary-address eigrp [AS] ${result.summaries[0].network.split('/')[0]} ${result.summaries[0].mask}</span>
                            </div>
                            <div class="result-item">
                                <strong>OSPF Summary:</strong>
                                <span class="value">area 0 range ${result.summaries[0].network.split('/')[0]} ${result.summaries[0].mask}</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            container.innerHTML = html;
            addCopyButtons(container);

        } catch (error) {
            alert(`Error processing networks: ${error.message}`);
            console.error('Route summarization error:', error);
        }
    });

    // 3. ACL Wildcard Generator
    document.getElementById('acl-wildcard-form').addEventListener('submit', e => {
        e.preventDefault();
        const network = document.getElementById('acl-network').value.trim();
        const maskInput = document.getElementById('acl-mask').value.trim();

        if (!isValidIp(network)) {
            alert('Please enter a valid network address.');
            return;
        }

        const results = calculateSubnet(network, maskInput);
        if (!results) {
            alert('Invalid subnet mask.');
            return;
        }

        const container = document.getElementById('acl-wildcard-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>ACL Configuration</h3>
                <div class="result-item">
                    <strong>Network:</strong>
                    <span class="value">${network}</span>
                </div>
                <div class="result-item">
                    <strong>Subnet Mask:</strong>
                    <span class="value">${results.subnetMask}</span>
                </div>
                <div class="result-item">
                    <strong>Wildcard Mask:</strong>
                    <span class="value">${results.wildcardMask}</span>
                </div>
                <div class="result-item">
                    <strong>ACL Permit Command:</strong>
                    <span class="value">access-list 101 permit ip ${network} ${results.wildcardMask}</span>
                </div>
                <div class="result-item">
                    <strong>ACL Deny Command:</strong>
                    <span class="value">access-list 101 deny ip ${network} ${results.wildcardMask}</span>
                </div>
                <div class="result-item">
                    <strong>Network Range:</strong>
                    <span class="value">${results.networkId} - ${results.broadcast}</span>
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 4. Quiz Mode
    let currentQuestion = null;
    let quizScore = { correct: 0, total: 0 };

    function generateQuestion() {
        const questionTypes = [
            { type: 'network-id', question: 'What is the network ID of {ip}/{cidr}?', answer: 'networkId' },
            { type: 'broadcast', question: 'What is the broadcast address of {ip}/{cidr}?', answer: 'broadcast' },
            { type: 'first-host', question: 'What is the first usable host of {ip}/{cidr}?', answer: 'firstHost' },
            { type: 'last-host', question: 'What is the last usable host of {ip}/{cidr}?', answer: 'lastHost' },
            { type: 'subnet-mask', question: 'What is the subnet mask for /{cidr}?', answer: 'subnetMask' },
            { type: 'cidr-from-mask', question: 'What is the CIDR notation for subnet mask {mask}?', answer: 'cidr' },
            { type: 'total-hosts', question: 'How many total hosts are in /{cidr}?', answer: 'totalHosts' },
            { type: 'usable-hosts', question: 'How many usable hosts are in /{cidr}?', answer: 'usableHosts' }
        ];

        const questionType = questionTypes[Math.floor(Math.random() * questionTypes.length)];

        // Generate random IP and CIDR
        const classRanges = [
            { min: 1, max: 126 },   // Class A
            { min: 128, max: 191 }, // Class B
            { min: 192, max: 223 }  // Class C
        ];
        const cls = classRanges[Math.floor(Math.random() * classRanges.length)];
        const ip = `${Math.floor(Math.random() * (cls.max - cls.min + 1)) + cls.min}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
        const cidr = Math.floor(Math.random() * 16) + 16; // /16 to /31

        const results = calculateSubnet(ip, `/${cidr}`);
        const correctAnswer = results[questionType.answer];

        // Generate wrong answers
        const wrongAnswers = [];
        for (let i = 0; i < 3; i++) {
            let wrongAnswer;
            do {
                if (typeof correctAnswer === 'number') {
                    wrongAnswer = correctAnswer + (Math.floor(Math.random() * 20) - 10);
                    wrongAnswer = Math.max(1, wrongAnswer);
                } else if (correctAnswer.includes('.')) {
                    // IP address - modify one octet
                    const parts = correctAnswer.split('.');
                    const randomOctet = Math.floor(Math.random() * 4);
                    parts[randomOctet] = (parseInt(parts[randomOctet]) + Math.floor(Math.random() * 10) + 1) % 256;
                    wrongAnswer = parts.join('.');
                } else {
                    wrongAnswer = `/${Math.max(8, Math.min(30, cidr + Math.floor(Math.random() * 8) - 4))}`;
                }
            } while (wrongAnswers.includes(wrongAnswer) || wrongAnswer === correctAnswer);
            wrongAnswers.push(wrongAnswer);
        }

        const allAnswers = [correctAnswer, ...wrongAnswers].sort(() => Math.random() - 0.5);

        return {
            question: questionType.question.replace('{ip}', ip).replace('{cidr}', cidr).replace('{mask}', results.subnetMask),
            answers: allAnswers,
            correctAnswer: correctAnswer,
            correctIndex: allAnswers.indexOf(correctAnswer),
            explanation: `Network: ${results.networkId}/${cidr}, Broadcast: ${results.broadcast}, First Host: ${results.firstHost}, Last Host: ${results.lastHost}`
        };
    }

    function displayQuestion() {
        currentQuestion = generateQuestion();

        document.getElementById('quiz-question').textContent = currentQuestion.question;

        const optionsContainer = document.getElementById('quiz-options');
        optionsContainer.innerHTML = '';

        currentQuestion.answers.forEach((answer, index) => {
            const optionDiv = document.createElement('div');
            optionDiv.className = 'quiz-option';
            optionDiv.textContent = answer;
            optionDiv.addEventListener('click', () => selectAnswer(index));
            optionsContainer.appendChild(optionDiv);
        });

        document.getElementById('quiz-feedback').textContent = '';
        document.getElementById('quiz-feedback').className = 'quiz-feedback';
        document.getElementById('next-question').style.display = 'none';
    }

    function selectAnswer(selectedIndex) {
        const options = document.querySelectorAll('.quiz-option');
        const feedback = document.getElementById('quiz-feedback');

        options.forEach((option, index) => {
            option.classList.remove('selected', 'correct', 'incorrect');
            if (index === selectedIndex) {
                option.classList.add('selected');
            }
            if (index === currentQuestion.correctIndex) {
                option.classList.add('correct');
            } else if (index === selectedIndex) {
                option.classList.add('incorrect');
            }
        });

        if (selectedIndex === currentQuestion.correctIndex) {
            quizScore.correct++;
            feedback.textContent = 'Correct! ' + currentQuestion.explanation;
            feedback.classList.add('correct');
        } else {
            feedback.textContent = `Incorrect. The correct answer is ${currentQuestion.correctAnswer}. ${currentQuestion.explanation}`;
            feedback.classList.add('incorrect');
        }

        quizScore.total++;
        updateScore();
        document.getElementById('next-question').style.display = 'block';
    }

    function updateScore() {
        const scoreElement = document.getElementById('quiz-score');
        const percentage = quizScore.total > 0 ? Math.round((quizScore.correct / quizScore.total) * 100) : 0;
        scoreElement.textContent = `Score: ${quizScore.correct}/${quizScore.total} (${percentage}%)`;
    }

    document.getElementById('next-question').addEventListener('click', displayQuestion);

    // Initialize quiz
    displayQuestion();

    // 5. Subnet Allocation Table
    document.getElementById('subnet-table-form').addEventListener('submit', e => {
        e.preventDefault();
        const baseNetwork = document.getElementById('table-network').value.trim();
        const maskInput = document.getElementById('table-mask').value.trim();
        const maxSubnets = parseInt(document.getElementById('max-subnets').value);

        if (!isValidIp(baseNetwork)) {
            alert('Please enter a valid base network address.');
            return;
        }

        const baseResults = calculateSubnet(baseNetwork, maskInput);
        if (!baseResults) {
            alert('Invalid subnet mask.');
            return;
        }

        const container = document.getElementById('subnet-table-results');
        container.innerHTML = '<div class="subnet-table-container"><table class="subnet-table"><thead><tr><th>Subnet #</th><th>Network ID</th><th>First Host</th><th>Last Host</th><th>Broadcast</th><th>Usable Hosts</th></tr></thead><tbody></tbody></table></div>';

        const tbody = container.querySelector('tbody');
        const baseNetworkInt = ipToIntUtil(baseResults.networkId);
        const subnetSize = Math.pow(2, 32 - baseResults.cidr);

        for (let i = 0; i < maxSubnets; i++) {
            const subnetNetworkInt = baseNetworkInt + (i * subnetSize);
            const subnetNetwork = intToIpUtil(subnetNetworkInt);
            const subnetResults = calculateSubnet(subnetNetwork, `/${baseResults.cidr}`);

            const row = tbody.insertRow();
            row.insertCell(0).textContent = i + 1;
            row.insertCell(1).textContent = subnetResults.networkId;
            row.insertCell(2).textContent = subnetResults.firstHost;
            row.insertCell(3).textContent = subnetResults.lastHost;
            row.insertCell(4).textContent = subnetResults.broadcast;
            row.insertCell(5).textContent = subnetResults.usableHosts;
        }

        addCopyButtons(container);
    });

    // 6. VLSM Calculator
    document.getElementById('vlsm-calculator-form').addEventListener('submit', e => {
        e.preventDefault();
        const baseNetwork = document.getElementById('vlsm-base-network').value.trim();
        const requirementsText = document.getElementById('vlsm-subnet-requirements').value.trim();

        if (!isValidIp(baseNetwork)) {
            alert('Please enter a valid base network address.');
            return;
        }

        const requirements = requirementsText.split(',').map(req => parseInt(req.trim())).filter(req => !isNaN(req) && req > 0);
        if (requirements.length === 0) {
            alert('Please enter valid subnet requirements.');
            return;
        }

        // Sort requirements in descending order for VLSM
        requirements.sort((a, b) => b - a);

        const container = document.getElementById('vlsm-calculator-results');
        container.innerHTML = '<div class="result-card"><h3>VLSM Subnet Allocation</h3><div id="vlsm-results-list"></div></div>';

        const resultsList = document.getElementById('vlsm-results-list');
        let currentNetwork = ipToIntUtil(baseNetwork);
        const allocations = [];

        for (let i = 0; i < requirements.length; i++) {
            const hostsNeeded = requirements[i];
            const bitsNeeded = Math.ceil(Math.log2(hostsNeeded + 2)); // +2 for network and broadcast
            const cidr = Math.max(1, Math.min(32, 32 - bitsNeeded));
            const subnetSize = Math.pow(2, 32 - cidr);

            const networkId = intToIpUtil(currentNetwork);
            const results = calculateSubnet(networkId, `/${cidr}`);

            allocations.push({
                subnet: i + 1,
                networkId: results.networkId,
                subnetMask: results.subnetMask,
                cidr,
                hostsNeeded,
                usableHosts: results.usableHosts,
                firstHost: results.firstHost,
                lastHost: results.lastHost,
                broadcast: results.broadcast
            });

            currentNetwork += subnetSize;
        }

        allocations.forEach(alloc => {
            const allocDiv = document.createElement('div');
            allocDiv.className = 'vlsm-allocation';
            allocDiv.innerHTML = `
                <h4>Subnet ${alloc.subnet}</h4>
                <div class="result-item">
                    <strong>Network ID:</strong>
                    <span class="value">${alloc.networkId}/${alloc.cidr}</span>
                </div>
                <div class="result-item">
                    <strong>Subnet Mask:</strong>
                    <span class="value">${alloc.subnetMask}</span>
                </div>
                <div class="result-item">
                    <strong>Hosts Needed:</strong>
                    <span class="value">${alloc.hostsNeeded}</span>
                </div>
                <div class="result-item">
                    <strong>Usable Hosts:</strong>
                    <span class="value">${alloc.usableHosts}</span>
                </div>
                <div class="result-item">
                    <strong>Host Range:</strong>
                    <span class="value">${alloc.firstHost} - ${alloc.lastHost}</span>
                </div>
                <div class="result-item">
                    <strong>Broadcast:</strong>
                    <span class="value">${alloc.broadcast}</span>
                </div>
            `;
            resultsList.appendChild(allocDiv);
        });

        addCopyButtons(container);
    });

    // 7. IP Binary Converter
    document.getElementById('ip-binary-converter-form').addEventListener('submit', e => {
        e.preventDefault();
        const ipInput = document.getElementById('ip-binary-input').value.trim();

        if (!isValidIp(ipInput)) {
            alert('Please enter a valid IP address.');
            return;
        }

        const ipParts = ipInput.split('.').map(part => parseInt(part));
        const binaryParts = ipParts.map(part => part.toString(2).padStart(8, '0'));
        const fullBinary = binaryParts.join('.');
        const hexParts = ipParts.map(part => part.toString(16).padStart(2, '0').toUpperCase());
        const fullHex = hexParts.join('');

        const container = document.getElementById('ip-binary-converter-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>IP Address Conversion</h3>
                <div class="result-item">
                    <strong>Decimal:</strong>
                    <span class="value">${ipInput}</span>
                </div>
                <div class="result-item">
                    <strong>Binary:</strong>
                    <span class="value">${fullBinary}</span>
                </div>
                <div class="result-item">
                    <strong>Hexadecimal:</strong>
                    <span class="value">${fullHex}</span>
                </div>
                <div class="binary-breakdown">
                    <strong>Binary Breakdown:</strong><br>
                    ${binaryParts.map((bin, i) => `${ipParts[i]} = ${bin}`).join(' . ')}
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 8. OSPF Network Type Tool
    document.getElementById('ospf-network-type-form').addEventListener('submit', e => {
        e.preventDefault();
        const network = document.getElementById('ospf-network').value.trim();
        const maskInput = document.getElementById('ospf-mask').value.trim();

        if (!isValidIp(network)) {
            alert('Please enter a valid network address.');
            return;
        }

        const results = calculateSubnet(network, maskInput);
        if (!results) {
            alert('Invalid subnet mask.');
            return;
        }

        let ospfType = 'Point-to-Point';
        let explanation = 'Default OSPF network type for serial links';

        if (results.cidr >= 24 && results.cidr <= 30) {
            if (results.usableHosts === 2) {
                ospfType = 'Point-to-Point';
                explanation = 'Two usable hosts - typically serial link';
            } else {
                ospfType = 'Broadcast';
                explanation = 'Multi-access network with multiple hosts';
            }
        } else if (results.cidr < 24) {
            ospfType = 'Non-Broadcast Multi-Access (NBMA)';
            explanation = 'Large network requiring DR/BDR election';
        } else if (results.cidr === 32) {
            ospfType = 'Point-to-Point';
            explanation = 'Host route - single host network';
        }

        const container = document.getElementById('ospf-network-type-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>OSPF Network Type Analysis</h3>
                <div class="result-item">
                    <strong>Network:</strong>
                    <span class="value">${results.networkId}/${results.cidr}</span>
                </div>
                <div class="result-item">
                    <strong>OSPF Network Type:</strong>
                    <span class="value">${ospfType}</span>
                </div>
                <div class="result-item">
                    <strong>Explanation:</strong>
                    <span class="value">${explanation}</span>
                </div>
                <div class="result-item">
                    <strong>Usable Hosts:</strong>
                    <span class="value">${results.usableHosts}</span>
                </div>
                <div class="result-item">
                    <strong>OSPF Configuration:</strong>
                    <span class="value">ip ospf network ${ospfType.toLowerCase().replace(/ /g, '-')}</span>
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 9. DHCP Scope Calculator
    document.getElementById('dhcp-scope-calculator-form').addEventListener('submit', e => {
        e.preventDefault();
        const network = document.getElementById('dhcp-network').value.trim();
        const maskInput = document.getElementById('dhcp-mask').value.trim();

        if (!isValidIp(network)) {
            alert('Please enter a valid network address.');
            return;
        }

        const results = calculateSubnet(network, maskInput);
        if (!results) {
            alert('Invalid subnet mask.');
            return;
        }

        const totalAddresses = results.totalHosts;
        const networkAddress = results.networkId;
        const broadcastAddress = results.broadcast;
        const firstUsable = results.firstHost;
        const lastUsable = results.lastHost;

        // Typical DHCP scope: exclude network and broadcast, reserve some for static
        const dhcpPoolStart = intToIpUtil(ipToIntUtil(firstUsable) + 10); // Reserve first 10 for static
        const dhcpPoolEnd = intToIpUtil(ipToIntUtil(lastUsable) - 10); // Reserve last 10 for static
        const availableForDHCP = Math.max(0, ipToIntUtil(dhcpPoolEnd) - ipToIntUtil(dhcpPoolStart) + 1);

        const container = document.getElementById('dhcp-scope-calculator-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>DHCP Scope Configuration</h3>
                <div class="result-item">
                    <strong>Network:</strong>
                    <span class="value">${networkAddress}/${results.cidr}</span>
                </div>
                <div class="result-item">
                    <strong>Subnet Mask:</strong>
                    <span class="value">${results.subnetMask}</span>
                </div>
                <div class="result-item">
                    <strong>Total Addresses:</strong>
                    <span class="value">${totalAddresses}</span>
                </div>
                <div class="result-item">
                    <strong>Network Address:</strong>
                    <span class="value">${networkAddress}</span>
                </div>
                <div class="result-item">
                    <strong>DHCP Pool Start:</strong>
                    <span class="value">${dhcpPoolStart}</span>
                </div>
                <div class="result-item">
                    <strong>DHCP Pool End:</strong>
                    <span class="value">${dhcpPoolEnd}</span>
                </div>
                <div class="result-item">
                    <strong>Broadcast Address:</strong>
                    <span class="value">${broadcastAddress}</span>
                </div>
                <div class="result-item">
                    <strong>Available for DHCP:</strong>
                    <span class="value">${availableForDHCP} addresses</span>
                </div>
                <div class="result-item">
                    <strong>DHCP Commands:</strong>
                    <span class="value">
                        ip dhcp pool MYPOOL<br>
                        network ${networkAddress} ${results.subnetMask}<br>
                        default-router ${networkAddress.split('.').slice(0, 3).join('.')}.1<br>
                        dns-server 8.8.8.8
                    </span>
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 10. Hex/IP Converter
    document.getElementById('hex-ip-converter-form').addEventListener('submit', e => {
        e.preventDefault();
        const hexInput = document.getElementById('hex-ip-input').value.trim().toUpperCase();

        if (!/^[0-9A-F]{8}$/.test(hexInput)) {
            alert('Please enter a valid 8-character hexadecimal string (e.g., C0A80101).');
            return;
        }

        const ipParts = [];
        for (let i = 0; i < 8; i += 2) {
            ipParts.push(parseInt(hexInput.substr(i, 2), 16));
        }
        const ipAddress = ipParts.join('.');

        const container = document.getElementById('hex-ip-converter-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>Hex to IP Conversion</h3>
                <div class="result-item">
                    <strong>Hexadecimal:</strong>
                    <span class="value">${hexInput}</span>
                </div>
                <div class="result-item">
                    <strong>IP Address:</strong>
                    <span class="value">${ipAddress}</span>
                </div>
                <div class="result-item">
                    <strong>Binary:</strong>
                    <span class="value">${ipParts.map(part => part.toString(2).padStart(8, '0')).join('.')}</span>
                </div>
                <div class="hex-breakdown">
                    <strong>Hex Breakdown:</strong><br>
                    ${hexInput.match(/.{2}/g).map((hex, i) => `${hex} = ${parseInt(hex, 16)}`).join(' . ')}
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 11. NAT Calculator
    document.getElementById('nat-calculator-form').addEventListener('submit', e => {
        e.preventDefault();
        const insideIP = document.getElementById('nat-inside-ip').value.trim();
        const outsideIP = document.getElementById('nat-outside-ip').value.trim();
        const natType = document.getElementById('nat-type').value;

        if (!isValidIp(insideIP) || !isValidIp(outsideIP)) {
            alert('Please enter valid IP addresses.');
            return;
        }

        let natDescription = '';
        let configuration = '';

        switch (natType) {
            case 'static':
                natDescription = 'Static NAT: One-to-one mapping between inside and outside addresses';
                configuration = `ip nat inside source static ${insideIP} ${outsideIP}`;
                break;
            case 'dynamic':
                natDescription = 'Dynamic NAT: Many-to-many mapping using a pool of addresses';
                configuration = `ip nat pool MYPOOL ${outsideIP} ${outsideIP}\nip nat inside source list 1 pool MYPOOL`;
                break;
            case 'pat':
                natDescription = 'PAT (Port Address Translation): Many-to-one mapping using ports';
                configuration = `ip nat inside source list 1 interface ${outsideIP.split('.')[3]} overload`;
                break;
        }

        const container = document.getElementById('nat-calculator-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>NAT Configuration</h3>
                <div class="result-item">
                    <strong>Inside Local IP:</strong>
                    <span class="value">${insideIP}</span>
                </div>
                <div class="result-item">
                    <strong>Outside Global IP:</strong>
                    <span class="value">${outsideIP}</span>
                </div>
                <div class="result-item">
                    <strong>NAT Type:</strong>
                    <span class="value">${natType.toUpperCase()}</span>
                </div>
                <div class="result-item">
                    <strong>Description:</strong>
                    <span class="value">${natDescription}</span>
                </div>
                <div class="result-item">
                    <strong>Cisco Configuration:</strong>
                    <span class="value">${configuration.replace(/\n/g, '<br>')}</span>
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 12. IPv4/IPv6 Converter
    document.getElementById('ipv4-ipv6-converter-form').addEventListener('submit', e => {
        e.preventDefault();
        const ipv4Input = document.getElementById('ipv4-input').value.trim();

        if (!isValidIp(ipv4Input)) {
            alert('Please enter a valid IPv4 address.');
            return;
        }

        const ipv4Parts = ipv4Input.split('.').map(part => parseInt(part));
        const ipv6Mapped = `::ffff:${ipv4Parts.map(part => part.toString(16).padStart(2, '0')).join(':')}`;
        const ipv6Compatible = `::${ipv4Parts.map(part => part.toString(16).padStart(2, '0')).join(':')}`;

        const container = document.getElementById('ipv4-ipv6-converter-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>IPv4 to IPv6 Conversion</h3>
                <div class="result-item">
                    <strong>IPv4 Address:</strong>
                    <span class="value">${ipv4Input}</span>
                </div>
                <div class="result-item">
                    <strong>IPv6 Mapped (::ffff:):</strong>
                    <span class="value">${ipv6Mapped}</span>
                </div>
                <div class="result-item">
                    <strong>IPv6 Compatible (::):</strong>
                    <span class="value">${ipv6Compatible}</span>
                </div>
                <div class="result-item">
                    <strong>Binary Representation:</strong>
                    <span class="value">${ipv4Parts.map(part => part.toString(2).padStart(8, '0')).join('.')}</span>
                </div>
                <div class="result-item">
                    <strong>Hex Representation:</strong>
                    <span class="value">${ipv4Parts.map(part => part.toString(16).padStart(2, '0')).join('')}</span>
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 13. Network Speed Calculator
    document.getElementById('network-speed-calculator-form').addEventListener('submit', e => {
        e.preventDefault();
        const dataSize = parseFloat(document.getElementById('data-size').value);
        const dataUnit = document.getElementById('data-unit').value;
        const bandwidth = parseFloat(document.getElementById('bandwidth').value);
        const bandwidthUnit = document.getElementById('bandwidth-unit').value;

        if (isNaN(dataSize) || isNaN(bandwidth) || dataSize <= 0 || bandwidth <= 0) {
            alert('Please enter valid positive numbers.');
            return;
        }

        // Convert to bits
        let dataBits = dataSize;
        switch (dataUnit) {
            case 'GB': dataBits *= 8 * 1024 * 1024 * 1024; break;
            case 'MB': dataBits *= 8 * 1024 * 1024; break;
            case 'TB': dataBits *= 8 * 1024 * 1024 * 1024 * 1024; break;
        }

        let bandwidthBps = bandwidth;
        switch (bandwidthUnit) {
            case 'Gbps': bandwidthBps *= 1000000000; break;
            case 'Mbps': bandwidthBps *= 1000000; break;
            case 'Tbps': bandwidthBps *= 1000000000000; break;
        }

        const transferTimeSeconds = dataBits / bandwidthBps;
        const transferTimeMinutes = transferTimeSeconds / 60;
        const transferTimeHours = transferTimeMinutes / 60;

        const container = document.getElementById('network-speed-calculator-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>Network Transfer Time Calculation</h3>
                <div class="result-item">
                    <strong>Data Size:</strong>
                    <span class="value">${dataSize} ${dataUnit}</span>
                </div>
                <div class="result-item">
                    <strong>Bandwidth:</strong>
                    <span class="value">${bandwidth} ${bandwidthUnit}</span>
                </div>
                <div class="result-item">
                    <strong>Transfer Time:</strong>
                    <span class="value">${transferTimeSeconds.toFixed(2)} seconds</span>
                </div>
                <div class="result-item">
                    <strong>Transfer Time:</strong>
                    <span class="value">${transferTimeMinutes.toFixed(2)} minutes</span>
                </div>
                <div class="result-item">
                    <strong>Transfer Time:</strong>
                    <span class="value">${transferTimeHours.toFixed(4)} hours</span>
                </div>
                <div class="result-item">
                    <strong>Data Rate:</strong>
                    <span class="value">${(bandwidthBps / 1000000).toFixed(2)} Mbps actual throughput</span>
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 14. TCP Flags Calculator
    document.getElementById('tcp-flags-calculator-form').addEventListener('submit', e => {
        e.preventDefault();
        const hexInput = document.getElementById('tcp-flags-hex').value.trim().toLowerCase();
        const urgFlag = document.getElementById('urg-flag').checked;
        const ackFlag = document.getElementById('ack-flag').checked;
        const pshFlag = document.getElementById('psh-flag').checked;
        const rstFlag = document.getElementById('rst-flag').checked;
        const synFlag = document.getElementById('syn-flag').checked;
        const finFlag = document.getElementById('fin-flag').checked;

        let flagsValue = 0;
        let flagsDescription = [];

        if (urgFlag) { flagsValue |= 32; flagsDescription.push('URG'); }
        if (ackFlag) { flagsValue |= 16; flagsDescription.push('ACK'); }
        if (pshFlag) { flagsValue |= 8; flagsDescription.push('PSH'); }
        if (rstFlag) { flagsValue |= 4; flagsDescription.push('RST'); }
        if (synFlag) { flagsValue |= 2; flagsDescription.push('SYN'); }
        if (finFlag) { flagsValue |= 1; flagsDescription.push('FIN'); }

        const hexValue = '0x' + flagsValue.toString(16).padStart(2, '0').toUpperCase();
        const binaryValue = flagsValue.toString(2).padStart(8, '0');

        let tcpState = 'Unknown';
        if (synFlag && !ackFlag) tcpState = 'SYN (Connection Establishment)';
        else if (synFlag && ackFlag) tcpState = 'SYN-ACK (Connection Establishment)';
        else if (ackFlag && !synFlag && !finFlag && !rstFlag) tcpState = 'ACK (Established Connection)';
        else if (finFlag && ackFlag) tcpState = 'FIN-ACK (Connection Termination)';
        else if (rstFlag) tcpState = 'RST (Connection Reset)';
        else if (pshFlag && ackFlag) tcpState = 'PSH-ACK (Data Transfer)';

        const container = document.getElementById('tcp-flags-calculator-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>TCP Flags Analysis</h3>
                <div class="result-item">
                    <strong>Hex Value:</strong>
                    <span class="value">${hexValue}</span>
                </div>
                <div class="result-item">
                    <strong>Decimal Value:</strong>
                    <span class="value">${flagsValue}</span>
                </div>
                <div class="result-item">
                    <strong>Binary Value:</strong>
                    <span class="value">${binaryValue}</span>
                </div>
                <div class="result-item">
                    <strong>Set Flags:</strong>
                    <span class="value">${flagsDescription.join(', ') || 'None'}</span>
                </div>
                <div class="result-item">
                    <strong>TCP State:</strong>
                    <span class="value">${tcpState}</span>
                </div>
                <div class="result-item">
                    <strong>Flag Positions:</strong>
                    <span class="value">URG(32) ACK(16) PSH(8) RST(4) SYN(2) FIN(1)</span>
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

    // 15. Network Troubleshooter
    document.getElementById('network-troubleshooter-form').addEventListener('submit', e => {
        e.preventDefault();
        const ip = document.getElementById('troubleshoot-ip').value.trim();
        const mask = document.getElementById('troubleshoot-mask').value.trim();
        const gateway = document.getElementById('troubleshoot-gateway').value.trim();

        if (!isValidIp(ip) || !isValidIp(gateway)) {
            alert('Please enter valid IP addresses.');
            return;
        }

        const results = calculateSubnet(ip, mask);
        if (!results) {
            alert('Invalid subnet mask.');
            return;
        }

        const issues = [];
        const recommendations = [];

        // Check if IP is valid for the subnet
        if (ip !== results.networkId && ip !== results.broadcast) {
            issues.push('IP address is valid for this subnet');
        } else {
            issues.push('IP address is network or broadcast address');
            recommendations.push('Use a host address between ' + results.firstHost + ' and ' + results.lastHost);
        }

        // Check gateway
        if (gateway === ip) {
            issues.push('Gateway cannot be the same as host IP');
            recommendations.push('Gateway should be a different IP in the same subnet');
        }

        // Check if gateway is in the same subnet
        const gatewayInt = ipToInt(gateway);
        const networkInt = ipToInt(results.networkId);
        const broadcastInt = ipToInt(results.broadcast);

        if (gatewayInt <= networkInt || gatewayInt >= broadcastInt) {
            issues.push('Gateway is not in the same subnet');
            recommendations.push('Gateway must be in the range ' + results.firstHost + ' to ' + results.lastHost);
        } else {
            issues.push('Gateway is in the same subnet ✓');
        }

        // Check subnet mask validity
        if (results.cidr < 8 || results.cidr > 30) {
            issues.push('Unusual subnet mask - verify network requirements');
        }

        const container = document.getElementById('network-troubleshooter-results');
        container.innerHTML = `
            <div class="result-card">
                <h3>Network Configuration Analysis</h3>
                <div class="result-item">
                    <strong>IP Address:</strong>
                    <span class="value">${ip}</span>
                </div>
                <div class="result-item">
                    <strong>Subnet Mask:</strong>
                    <span class="value">${results.subnetMask} (${results.cidr})</span>
                </div>
                <div class="result-item">
                    <strong>Network:</strong>
                    <span class="value">${results.networkId}/${results.cidr}</span>
                </div>
                <div class="result-item">
                    <strong>Gateway:</strong>
                    <span class="value">${gateway}</span>
                </div>
                <div class="result-item">
                    <strong>Issues Found:</strong>
                    <span class="value">${issues.join('<br>')}</span>
                </div>
                ${recommendations.length > 0 ? `
                <div class="result-item">
                    <strong>Recommendations:</strong>
                    <span class="value">${recommendations.join('<br>')}</span>
                </div>
                ` : ''}
                <div class="result-item">
                    <strong>Host Range:</strong>
                    <span class="value">${results.firstHost} - ${results.lastHost}</span>
                </div>
                <div class="result-item">
                    <strong>Broadcast:</strong>
                    <span class="value">${results.broadcast}</span>
                </div>
            </div>
        `;

        addCopyButtons(container);
    });

})();

