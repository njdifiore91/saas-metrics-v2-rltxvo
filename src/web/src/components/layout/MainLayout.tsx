import React, { useCallback, useEffect } from 'react';
import { styled } from '@mui/material/styles'; // v5.0.0
import { Box, useTheme, useMediaQuery } from '@mui/material'; // v5.0.0
import { useLocalStorage } from 'react-use'; // v17.4.0
import Header, { HeaderProps } from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

// Styled components with theme integration
const StyledRoot = styled('div')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  minHeight: '100vh',
  backgroundColor: theme.palette.background.default,
}));

const StyledMainContent = styled(Box, {
  shouldForwardProp: prop => prop !== 'open' && prop !== 'isMobile',
})<{ open?: boolean; isMobile?: boolean }>(({ theme, open, isMobile }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: 0,
  width: '100%',
  ...(open && !isMobile && {
    marginLeft: 256,
    width: `calc(100% - 256px)`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
  [theme.breakpoints.down('sm')]: {
    padding: theme.spacing(2),
  },
}));

// Skip link for keyboard navigation
const SkipLink = styled('a')(({ theme }) => ({
  position: 'absolute',
  left: -9999,
  top: -9999,
  background: theme.palette.background.paper,
  padding: theme.spacing(2),
  zIndex: theme.zIndex.tooltip + 1,
  '&:focus': {
    left: theme.spacing(2),
    top: theme.spacing(2),
  },
}));

// Interface for component props
export interface MainLayoutProps {
  children: React.ReactNode;
  initialSidebarOpen?: boolean;
  className?: string;
  testId?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  initialSidebarOpen = true,
  className,
  testId = 'main-layout',
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [sidebarOpen, setSidebarOpen] = useLocalStorage(
    'sidebarOpen',
    initialSidebarOpen
  );

  // Handle sidebar toggle with persistence
  const handleSidebarToggle = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [sidebarOpen, setSidebarOpen]);

  // Handle keyboard navigation
  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && sidebarOpen && isMobile) {
      setSidebarOpen(false);
    }
  }, [sidebarOpen, isMobile, setSidebarOpen]);

  // Reset sidebar state on mobile/desktop switch
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(initialSidebarOpen);
    }
  }, [isMobile, initialSidebarOpen, setSidebarOpen]);

  // Handle session expiration
  const handleSessionExpired = useCallback(() => {
    // Redirect to login page with session expired message
    window.location.href = '/login?session=expired';
  }, []);

  return (
    <StyledRoot
      className={className}
      data-testid={testId}
      onKeyDown={handleKeyboardNavigation}
    >
      <SkipLink href="#main-content">
        Skip to main content
      </SkipLink>

      <Header
        onMenuClick={handleSidebarToggle}
        onSessionExpired={handleSessionExpired}
      />

      <Sidebar
        isOpen={Boolean(sidebarOpen)}
        onClose={handleSidebarToggle}
        isMobile={isMobile}
        ariaLabel="Main navigation"
      />

      <StyledMainContent
        component="main"
        id="main-content"
        open={Boolean(sidebarOpen)}
        isMobile={isMobile}
        role="main"
        aria-label="Main content"
      >
        {children}
      </StyledMainContent>

      <Footer />
    </StyledRoot>
  );
};

MainLayout.displayName = 'MainLayout';

export default MainLayout;