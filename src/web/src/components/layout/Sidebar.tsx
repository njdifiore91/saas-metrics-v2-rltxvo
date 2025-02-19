import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { styled } from '@mui/material/styles';
import { useMediaQuery } from '@mui/material';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Divider,
  Box,
  Typography,
  Collapse,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BarChartIcon from '@mui/icons-material/BarChart';
import CompareIcon from '@mui/icons-material/Compare';
import UploadIcon from '@mui/icons-material/Upload';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import HelpIcon from '@mui/icons-material/Help';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import { useAuth } from '../../hooks/useAuth';
import Button from '../common/Button';
import { UserRole } from '../../types/api.types';

// Styled components
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: 256,
  flexShrink: 0,
  '& .MuiDrawer-paper': {
    width: 256,
    boxSizing: 'border-box',
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

// Interfaces
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
  ariaLabel?: string;
}

interface MenuItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  roles: UserRole[];
  ariaLabel: string;
  shortcut?: string;
}

// Menu items configuration
const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: <DashboardIcon />,
    roles: [UserRole.GUEST, UserRole.USER, UserRole.ANALYST, UserRole.ADMIN],
    ariaLabel: 'Navigate to dashboard',
    shortcut: 'Alt+D',
  },
  {
    id: 'metrics',
    label: 'Metrics',
    path: '/metrics',
    icon: <BarChartIcon />,
    roles: [UserRole.USER, UserRole.ANALYST, UserRole.ADMIN],
    ariaLabel: 'View metrics',
    shortcut: 'Alt+M',
  },
  {
    id: 'compare',
    label: 'Compare',
    path: '/compare',
    icon: <CompareIcon />,
    roles: [UserRole.USER, UserRole.ANALYST, UserRole.ADMIN],
    ariaLabel: 'Compare metrics',
    shortcut: 'Alt+C',
  },
  {
    id: 'import',
    label: 'Import Data',
    path: '/import',
    icon: <UploadIcon />,
    roles: [UserRole.ANALYST, UserRole.ADMIN],
    ariaLabel: 'Import data',
    shortcut: 'Alt+I',
  },
  {
    id: 'saved',
    label: 'Saved Views',
    path: '/saved',
    icon: <BookmarkIcon />,
    roles: [UserRole.USER, UserRole.ANALYST, UserRole.ADMIN],
    ariaLabel: 'View saved reports',
    shortcut: 'Alt+S',
  },
  {
    id: 'help',
    label: 'Help',
    path: '/help',
    icon: <HelpIcon />,
    roles: [UserRole.GUEST, UserRole.USER, UserRole.ANALYST, UserRole.ADMIN],
    ariaLabel: 'Get help',
    shortcut: 'Alt+H',
  },
];

const Sidebar: React.FC<SidebarProps> = React.memo(({
  isOpen,
  onClose,
  isMobile,
  ariaLabel = 'Main navigation',
}) => {
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up('md'));

  // Filter menu items based on user role
  const filteredMenuItems = useMemo(() => 
    menuItems.filter(item => user && item.roles.some(role => hasRole(role))),
    [user, hasRole]
  );

  // Handle navigation with keyboard support
  const handleNavigation = useCallback((
    path: string,
    event: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    navigate(path);
    if (isMobile) {
      onClose();
    }
  }, [navigate, isMobile, onClose]);

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.altKey) {
      const menuItem = filteredMenuItems.find(
        item => item.shortcut === `Alt+${event.key.toUpperCase()}`
      );
      if (menuItem) {
        event.preventDefault();
        navigate(menuItem.path);
        if (isMobile) {
          onClose();
        }
      }
    }
  }, [filteredMenuItems, navigate, isMobile, onClose]);

  // Add keyboard listener
  React.useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const drawer = (
    <>
      <DrawerHeader>
        <IconButton
          onClick={onClose}
          aria-label="Close navigation menu"
          size="large"
        >
          {isMobile ? <ChevronLeftIcon /> : <MenuIcon />}
        </IconButton>
      </DrawerHeader>
      <Divider />
      <List role="navigation" aria-label={ariaLabel}>
        {filteredMenuItems.map((item) => (
          <ListItem
            key={item.id}
            onClick={(e) => handleNavigation(item.path, e)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleNavigation(item.path, e);
              }
            }}
            button
            component="div"
            role="menuitem"
            aria-label={item.ariaLabel}
            tabIndex={0}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              secondary={item.shortcut}
              primaryTypographyProps={{
                variant: "body1",
                color: "textPrimary"
              }}
              secondaryTypographyProps={{
                variant: "caption",
                color: "textSecondary"
              }}
            />
          </ListItem>
        ))}
      </List>
    </>
  );

  return (
    <StyledDrawer
      variant={isMobile ? 'temporary' : 'persistent'}
      anchor="left"
      open={isOpen}
      onClose={onClose}
      ModalProps={{
        keepMounted: true, // Better mobile performance
      }}
      role="complementary"
      aria-label={ariaLabel}
    >
      {drawer}
    </StyledDrawer>
  );
});

Sidebar.displayName = 'Sidebar';

export default Sidebar;