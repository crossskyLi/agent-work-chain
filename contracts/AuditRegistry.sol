// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AuditRegistry
 * @notice Core registry for the Audit Swarm protocol: third-party audit records,
 *         auditor registration with stake, trust scores from confirmed audits, and certifications.
 * @dev Pure Solidity without external dependencies. Owner governs confirmations, disputes, and certifications.
 */
contract AuditRegistry {
    /// @notice Contract administrator (set at deploy).
    address public owner;

    /// @notice Minimum wei required to register as an auditor (owner-configurable).
    uint256 public minStake;

    /// @notice Lifecycle of an audit record after submission.
    enum AuditStatus {
        Pending,
        Confirmed,
        Disputed
    }

    /// @notice Registered auditor profile and performance counters.
    struct Auditor {
        string specialties;
        uint256 stake;
        uint256 registeredAt;
        uint256 totalAudits;
        uint16 accuracyScore;
        bool registered;
    }

    /// @notice Single audit submission and resolution state.
    struct Audit {
        address auditor;
        address targetAgent;
        string reportCID;
        uint8 overallScore;
        string dimensions;
        uint256 timestamp;
        AuditStatus status;
        bool exists;
    }

    /// @notice On-chain certification validity window.
    struct Certification {
        uint256 issuedAt;
        uint256 validUntil;
        bool exists;
    }

    mapping(address => Auditor) private _auditors;
    mapping(string => Audit) private _audits;
    mapping(address => string[]) private _agentAuditIds;
    mapping(bytes32 => Certification) private _certifications;

    /// @param auditor Address that completed registration.
    /// @param specialties Comma-separated or free-form specialty labels.
    /// @param stake Wei deposited with registration.
    event AuditorRegistered(address auditor, string specialties, uint256 stake);

    /// @param auditId Protocol-unique audit identifier.
    /// @param auditor Submitter of the audit.
    /// @param targetAgent Agent under review.
    /// @param overallScore Aggregate score 0–100.
    event AuditSubmitted(string auditId, address auditor, address targetAgent, uint8 overallScore);

    /// @param auditId Confirmed audit identifier.
    event AuditConfirmed(string auditId);

    /// @param auditId Disputed audit identifier.
    /// @param reason Free-form dispute explanation (e.g. IPFS CID or short text).
    event AuditDisputeRaised(string auditId, string reason);

    /// @param agent Certified agent address.
    /// @param certType Certification kind (e.g. "security-tier-1").
    /// @param validUntil Unix timestamp after which the certification is invalid.
    event CertificationIssued(address agent, string certType, uint256 validUntil);

    error NotOwner();
    error AlreadyRegistered();
    error InsufficientStake();
    error AuditAlreadyExists();
    error AuditNotFound();
    error InvalidOverallScore();
    error InvalidAuditStatus();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /**
     * @notice Deploys the registry with `msg.sender` as owner and `minStake` initially zero.
     */
    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Updates the minimum stake required for `registerAuditor`.
     * @param newMinStake Minimum wei; existing auditors are unaffected.
     */
    function setMinStake(uint256 newMinStake) external onlyOwner {
        minStake = newMinStake;
    }

    /**
     * @notice Registers the caller as an auditor with specialties and staked value.
     * @dev Reverts if already registered or `msg.value` is below `minStake`.
     *      Initial `accuracyScore` is 5000 (50.00%).
     * @param specialties Human-readable specialty string (e.g. "code,security,performance").
     */
    function registerAuditor(string calldata specialties) external payable {
        if (_auditors[msg.sender].registered) revert AlreadyRegistered();
        if (msg.value < minStake) revert InsufficientStake();

        _auditors[msg.sender] = Auditor({
            specialties: specialties,
            stake: msg.value,
            registeredAt: block.timestamp,
            totalAudits: 0,
            accuracyScore: 5000,
            registered: true
        });

        emit AuditorRegistered(msg.sender, specialties, msg.value);
    }

    /**
     * @notice Returns the full auditor struct for `a`.
     * @param a Auditor address to query.
     */
    function getAuditor(address a) external view returns (Auditor memory) {
        return _auditors[a];
    }

    /**
     * @notice Submits an audit for a target agent. Caller is recorded as the auditor.
     * @dev `overallScore` must be 0–100. `dimensions` should encode nine-dimension scores (e.g. JSON).
     *      `auditId` must be unique. Appends `auditId` to `targetAgent` for trust aggregation.
     * @param auditId Unique string id for this audit.
     * @param targetAgent Address of the audited agent.
     * @param reportCID IPFS CID (or URI fragment) for the full report.
     * @param overallScore Aggregate score 0–100.
     * @param dimensions JSON or structured string of per-dimension scores.
     */
    function submitAudit(
        string calldata auditId,
        address targetAgent,
        string calldata reportCID,
        uint8 overallScore,
        string calldata dimensions
    ) external {
        if (_audits[auditId].exists) revert AuditAlreadyExists();
        if (overallScore > 100) revert InvalidOverallScore();

        _audits[auditId] = Audit({
            auditor: msg.sender,
            targetAgent: targetAgent,
            reportCID: reportCID,
            overallScore: overallScore,
            dimensions: dimensions,
            timestamp: block.timestamp,
            status: AuditStatus.Pending,
            exists: true
        });

        _agentAuditIds[targetAgent].push(auditId);

        emit AuditSubmitted(auditId, msg.sender, targetAgent, overallScore);
    }

    /**
     * @notice Owner confirms a pending audit: marks Confirmed and updates auditor metrics.
     * @dev Increments `totalAudits` and moves `accuracyScore` toward 10000 by 25 bps per confirmation (capped).
     * @param auditId Audit to confirm.
     */
    function confirmAudit(string calldata auditId) external onlyOwner {
        Audit storage a = _audits[auditId];
        if (!a.exists) revert AuditNotFound();
        if (a.status != AuditStatus.Pending) revert InvalidAuditStatus();

        a.status = AuditStatus.Confirmed;

        Auditor storage aud = _auditors[a.auditor];
        if (aud.registered) {
            aud.totalAudits += 1;
            uint256 next = uint256(aud.accuracyScore) + 25;
            if (next > 10_000) next = 10_000;
            aud.accuracyScore = uint16(next);
        }

        emit AuditConfirmed(auditId);
    }

    /**
     * @notice Owner disputes a pending audit.
     * @param auditId Audit to dispute.
     * @param reason Explanation or reference for the dispute.
     */
    function disputeAudit(string calldata auditId, string calldata reason) external onlyOwner {
        Audit storage a = _audits[auditId];
        if (!a.exists) revert AuditNotFound();
        if (a.status != AuditStatus.Pending) revert InvalidAuditStatus();

        a.status = AuditStatus.Disputed;

        emit AuditDisputeRaised(auditId, reason);
    }

    /**
     * @notice Average `overallScore` (0–100) over Confirmed audits and how many confirmed audits exist.
     * @param agent Agent address.
     * @return avgScore Integer average; 0 if no confirmed audits.
     * @return auditCount Number of confirmed audits for `agent`.
     */
    function getTrustScore(address agent) external view returns (uint8 avgScore, uint256 auditCount) {
        string[] storage ids = _agentAuditIds[agent];
        uint256 sum;
        uint256 count;

        for (uint256 i = 0; i < ids.length; i++) {
            Audit storage au = _audits[ids[i]];
            if (au.status == AuditStatus.Confirmed) {
                sum += au.overallScore;
                unchecked {
                    ++count;
                }
            }
        }

        if (count == 0) return (0, 0);

        avgScore = uint8(sum / count);
        auditCount = count;
    }

    /**
     * @notice Owner issues or replaces a certification for an agent and type.
     * @param agent Agent receiving the certification.
     * @param certType Certification category string.
     * @param validUntil Unix timestamp when certification ceases to be valid.
     */
    function issueCertification(address agent, string calldata certType, uint256 validUntil) external onlyOwner {
        bytes32 key = keccak256(abi.encode(agent, certType));
        _certifications[key] = Certification({issuedAt: block.timestamp, validUntil: validUntil, exists: true});

        emit CertificationIssued(agent, certType, validUntil);
    }

    /**
     * @notice Whether a certification is currently valid and its timestamps.
     * @param agent Agent address.
     * @param certType Certification type string.
     * @return valid True if record exists and `block.timestamp <= validUntil`.
     * @return issuedAt When the certification was recorded.
     * @return validUntil Expiry timestamp.
     */
    function getCertification(
        address agent,
        string calldata certType
    ) external view returns (bool valid, uint256 issuedAt, uint256 validUntil) {
        bytes32 key = keccak256(abi.encode(agent, certType));
        Certification storage c = _certifications[key];
        if (!c.exists) return (false, 0, 0);

        issuedAt = c.issuedAt;
        validUntil = c.validUntil;
        valid = block.timestamp <= c.validUntil;
    }
}
