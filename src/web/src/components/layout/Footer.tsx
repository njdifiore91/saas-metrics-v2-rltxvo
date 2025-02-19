import React from 'react'; // ^18.2.0
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material'; // ^5.0.0
import { styled } from '@mui/material/styles'; // ^5.0.0

// Styled footer container with responsive design and theme integration
const StyledFooter = styled(Box)(({ theme }) => ({
  width: '100%',
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'space-between',
  minHeight: theme.spacing(8),

  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    padding: theme.spacing(2, 3),
  },

  '& a': {
    color: theme.palette.text.secondary,
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
    '&:focus': {
      outline: `2px solid ${theme.palette.primary.main}`,
      outlineOffset: '2px',
    },
  },
}));

const Footer: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const currentYear = new Date().getFullYear();

  return (
    <StyledFooter component="footer" role="contentinfo">
      <Box
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          gap: theme.spacing(2),
          mb: isMobile ? 2 : 0,
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ fontFamily: 'Inter, sans-serif' }}
        >
          © {currentYear} Startup Metrics Platform. All rights reserved.
        </Typography>
      </Box>

      <Box
        component="nav"
        sx={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          alignItems: 'center',
          gap: theme.spacing(2),
        }}
      >
        <Typography
          component="a"
          href="/privacy"
          variant="body2"
          sx={{ fontFamily: 'Inter, sans-serif' }}
        >
          Privacy Policy
        </Typography>
        <Typography
          component="a"
          href="/terms"
          variant="body2"
          sx={{ fontFamily: 'Inter, sans-serif' }}
        >
          Terms of Service
        </Typography>
        <Typography
          component="a"
          href="/contact"
          variant="body2"
          sx={{ fontFamily: 'Inter, sans-serif' }}
        >
          Contact Us
        </Typography>
      </Box>
    </StyledFooter>
  );
};

export default Footer;