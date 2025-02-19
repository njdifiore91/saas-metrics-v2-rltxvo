/**
 * User management and authentication interfaces for the Startup Metrics Benchmarking Platform
 * Implements role-based access control and session management as per technical specifications
 * @version 1.0.0
 */

/**
 * Enumeration of user roles with hierarchical access levels
 * Maps to authorization levels defined in Technical Specifications 7.1.2
 */
export enum UserRole {
    ADMIN = 'ADMIN',        // Full system access
    ANALYST = 'ANALYST',    // High-level access with metric management
    USER = 'USER',         // Limited access for basic operations
    GUEST = 'GUEST'        // Minimal access for public benchmarks
}

/**
 * Core user interface defining essential user properties and metadata
 * Implements user management requirements from Technical Specifications 1.3
 */
export interface User {
    id: string;                // UUID v4 for user identification
    email: string;            // User's email address (unique)
    name: string;             // User's full name
    role: UserRole;           // User's assigned role determining access level
    createdAt: Date;          // Account creation timestamp
    lastLoginAt: Date;        // Last successful login timestamp
    isActive: boolean;        // Account status flag
}

/**
 * User session management interface
 * Implements session tracking requirements from Technical Specifications 7.1.3
 */
export interface UserSession {
    userId: string;           // Reference to User.id
    token: string;            // JWT token for session authentication
    expiresAt: Date;         // Session expiration timestamp (1 hour from creation)
    createdAt: Date;         // Session creation timestamp
    lastActivityAt: Date;     // Last activity timestamp for idle timeout
    ipAddress: string;        // IP address for security tracking
}

/**
 * Granular permission definitions for role-based access control
 * Maps specific capabilities to user roles as per Technical Specifications 7.1.2
 */
export type UserPermissions = {
    canViewMetrics: boolean;      // Permission to view benchmark metrics
    canEditMetrics: boolean;      // Permission to input and edit company metrics
    canGenerateReports: boolean;  // Permission to create and export reports
    canManageUsers: boolean;      // Permission to manage user accounts
    canConfigureSystem: boolean;  // Permission to modify system settings
    canExportData: boolean;       // Permission to export benchmark data
    canAccessAuditLogs: boolean;  // Permission to view security audit logs
}