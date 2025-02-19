import React, { useCallback, useState, useEffect } from 'react';
import styled from '@mui/material/styles/styled'; // v5.0.0
import { AppBar, Toolbar, IconButton, Menu, MenuItem, Typography, useMediaQuery } from '@mui/material'; // v5.0.0
import { Menu as MenuIcon, Help as HelpIcon, Settings as SettingsIcon } from '@mui/icons-material'; // v5.0.0
import { Button } from '../common/Button';
import { GoogleAuthButton } from '../auth/GoogleAuthButton';
import { useAuth } from '../../hooks/useAuth';

// Enhanced styled components with theme integration
const StyledAppBar = styled(AppBar)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main, // Deep Navy (#151e2d)
  height: '64px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  zIndex: theme.zIndex.appBar,
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  '& .MuiToolbar-root': {
    height: '100%',
    padding: theme.spacing(0, 3),
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(0, 1),
    },
  },
}));

const Logo = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  '& img': {
    height: '32px',
    marginRight: theme.spacing(2),
  },
  [theme.breakpoints.down('sm')]: {
    '& img': {
      height: '24px',
    },
  },
}));

const Actions = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(2),
  marginLeft: 'auto',
}));

// Interface for header props
export interface HeaderProps {
  className?: string;
  testId?: string;
  onSessionExpired?: () => void;
}

// Interface for session information
interface SessionInfo {
  expiresAt: Date;
  isActive: boolean;
  lastActivity: Date;
}

/**
 * Enhanced Header component with security features and responsive design
 */
export const Header = React.memo<HeaderProps>(({
  className,
  testId = 'header',
  onSessionExpired,
}) => {
  const { isAuthenticated, user, logout, sessionInfo } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isMobile = useMediaQuery((theme: any) => theme.breakpoints.down('sm'));
  const [sessionStatus, setSessionStatus] = useState<SessionInfo | null>(null);

  // Handle profile menu interactions
  const handleProfileMenuOpen = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  }, []);

  const handleProfileMenuClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handleLogout = useCallback(async () => {
    handleProfileMenuClose();
    await logout();
  }, [logout]);

  // Monitor session status
  useEffect(() => {
    if (sessionInfo && onSessionExpired) {
      const checkSession = () => {
        const now = new Date();
        if (sessionInfo.expiresAt < now) {
          onSessionExpired();
        }
        setSessionStatus({
          expiresAt: sessionInfo.expiresAt,
          isActive: sessionInfo.expiresAt > now,
          lastActivity: sessionInfo.lastActivity,
        });
      };

      const interval = setInterval(checkSession, 60000); // Check every minute
      checkSession(); // Initial check

      return () => clearInterval(interval);
    }
  }, [sessionInfo, onSessionExpired]);

  return (
    <StyledAppBar 
      className={className}
      data-testid={testId}
      role="banner"
      aria-label="Site header"
    >
      <Toolbar>
        {isMobile && (
          <IconButton
            edge="start"
            color="inherit"
            aria-label="Open menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
        )}

        <Logo>
          <img 
            src="/logo.svg" 
            alt="Startup Metrics Platform" 
            aria-label="Company logo"
          />
          {!isMobile && (
            <Typography variant="h6" component="h1">
              Startup Metrics
            </Typography>
          )}
        </Logo>

        <Actions>
          {isAuthenticated ? (
            <>
              <IconButton
                color="inherit"
                aria-label="Help center"
                title="Help center"
              >
                <HelpIcon />
              </IconButton>

              <IconButton
                color="inherit"
                aria-label="Settings"
                title="Settings"
              >
                <SettingsIcon />
              </IconButton>

              <Button
                variant="text"
                color="inherit"
                onClick={handleProfileMenuOpen}
                aria-label={`Profile menu for ${user?.name}`}
                aria-controls="profile-menu"
                aria-haspopup="true"
                aria-expanded={Boolean(anchorEl)}
              >
                {user?.name}
              </Button>

              <Menu
                id="profile-menu"
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleProfileMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                PaperProps={{
                  elevation: 3,
                  sx: { minWidth: 200 },
                }}
              >
                <MenuItem onClick={handleProfileMenuClose}>Profile</MenuItem>
                <MenuItem onClick={handleProfileMenuClose}>Settings</MenuItem>
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </>
          ) : (
            <GoogleAuthButton
              onSuccess={() => {
                // Handle successful authentication
              }}
              onError={(error) => {
                console.error('Authentication error:', error);
              }}
            />
          )}
        </Actions>
      </Toolbar>
    </StyledAppBar>
  );
});

Header.displayName = 'Header';

export default Header;