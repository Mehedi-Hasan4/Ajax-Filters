jQuery(document).ready(function ($) {
  let filterTimeout;
  let isFiltering = false;
  const isMobile = window.matchMedia('(max-width: 768px)').matches || filterAjax.isMobile;

  // Setup mobile UI elements
  function setupMobileElements() {
    if (isMobile) {
      // Add filter toggle button if it doesn't exist
      if ($('.filter-toggle-btn').length === 0) {
        $('#wc-custom-filters-container').prepend('<button class="filter-toggle-btn">Filter Products</button>');
      }
      
      // Wrap filter content in a box for toggling
      if (!$('#filter-sidebar').parent().hasClass('filter-content-box')) {
        $('#filter-sidebar').wrap('<div class="filter-content-box"></div>');
      }
      
      // Add apply filters button if it doesn't exist
      if ($('.apply-filters-btn').length === 0) {
        $('.filter-content-box').append('<button class="apply-filters-btn">Apply Filters</button>');
      }
    }
  }

  // Initialize price slider
  function initPriceSlider() {
    if (!$('#price-slider').length) return;
    
    const priceRange = filterAjax.priceRange;
    
    // Make sure we have valid price range
    if (!priceRange || priceRange.min === undefined || priceRange.max === undefined) {
      console.error('Price range not available');
      return;
    }
    
    $("#price-slider").slider({
      range: true,
      min: parseInt(priceRange.min),
      max: parseInt(priceRange.max),
      values: [parseInt(priceRange.min), parseInt(priceRange.max)],
      slide: function (event, ui) {
        $("#min_price").val(ui.values[0]);
        $("#max_price").val(ui.values[1]);
        updatePriceDisplay(ui.values[0], ui.values[1]);
        
        // Only auto-apply on desktop
        if (!isMobile) {
          clearTimeout(filterTimeout);
          filterTimeout = setTimeout(applyFilters, 500);
        }
      },
    });

    // Set initial values
    $("#min_price").val(priceRange.min);
    $("#max_price").val(priceRange.max);
    updatePriceDisplay(priceRange.min, priceRange.max);
  }

  function updatePriceDisplay(min, max) {
    $("#price-min-display").text("৳" + min);
    $("#price-max-display").text("৳" + max);
  }

  // Handle manual price input
  $("#min_price, #max_price").on("change keyup", function () {
    const priceRange = filterAjax.priceRange;
    const minPrice = parseInt($("#min_price").val()) || parseInt(priceRange.min);
    const maxPrice = parseInt($("#max_price").val()) || parseInt(priceRange.max);
    
    // Update slider if it exists
    if ($("#price-slider").length) {
      $("#price-slider").slider("values", [minPrice, maxPrice]);
    }
    updatePriceDisplay(minPrice, maxPrice);
    
    // Only auto-apply on desktop
    if (!isMobile) {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(applyFilters, 500);
    }
  });

  // Handle checkbox changes
  $("#filter-sidebar input[type='checkbox']").on("change", function () {
    updateSelectedFilters();
    
    // Only auto-apply on desktop
    if (!isMobile) {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(applyFilters, 300);
    }
  });

  // Toggle filter content on mobile
  $(document).on('click', '.filter-toggle-btn', function(e) {
    e.preventDefault();
    $(this).toggleClass('active');
    $('.filter-content-box').toggleClass('active');
    
    if ($(this).hasClass('active')) {
      $(this).text('Hide Filters');
    } else {
      $(this).text('Filter Products');
    }
  });

  // Apply filters button (mobile)
  $(document).on('click', '.apply-filters-btn', function(e) {
    e.preventDefault();
    applyFilters();
    
    // Hide the filter content box after applying on mobile
    if (isMobile) {
      $('.filter-content-box').removeClass('active');
      $('.filter-toggle-btn').removeClass('active').text('Filter Products');
    }
  });

  // Clear all filters
  $("#clear-all-filters").on("click", function(e) {
    e.preventDefault();
    clearAllFilters();
  });

  function updateSelectedFilters() {
    const selectedFilters = [];
    const activeFiltersList = $("#active-filters-list");
    
    // Price filters
    const minPrice = parseInt($("#min_price").val()) || 0;
    const maxPrice = parseInt($("#max_price").val()) || 0;
    const priceRange = filterAjax.priceRange;
    
    if (minPrice != parseInt(priceRange.min) || maxPrice != parseInt(priceRange.max)) {
      selectedFilters.push({
        type: 'price',
        text: `Price: ৳${minPrice} - ৳${maxPrice}`,
        remove: function() {
          $("#min_price").val(priceRange.min);
          $("#max_price").val(priceRange.max);
          if ($("#price-slider").length) {
            $("#price-slider").slider("values", [parseInt(priceRange.min), parseInt(priceRange.max)]);
          }
          updatePriceDisplay(priceRange.min, priceRange.max);
        }
      });
    }

    // Category filters
    $("input[name='categories[]']:checked").each(function() {
      selectedFilters.push({
        type: 'category',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).prop('checked', false);
        }
      });
    });

    // Size filters
    $("input[name='sizes[]']:checked").each(function() {
      selectedFilters.push({
        type: 'size',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).prop('checked', false);
        }
      });
    });

    // Color filters
    $("input[name='colors[]']:checked").each(function() {
      selectedFilters.push({
        type: 'color',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).prop('checked', false);
        }
      });
    });

    // Stock filters
    $("input[name='stock[]']:checked").each(function() {
      selectedFilters.push({
        type: 'stock',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).prop('checked', false);
        }
      });
    });

    // Update display
    activeFiltersList.empty();
    
    if (selectedFilters.length > 0) {
      selectedFilters.forEach(function(filter, index) {
        const filterTag = $(`
          <span class="active-filter-tag" data-filter-type="${filter.type}">
            ${filter.text}
            ${!isMobile ? '<button class="remove-filter" data-filter-index="' + index + '">&times;</button>' : ''}
          </span>
        `);
        activeFiltersList.append(filterTag);
      });
      
      $("#clear-all-filters").show();
      $(".selected-filters-container").show();
      
      // Update filter button text with count on mobile
      if (isMobile && $('.filter-toggle-btn').length) {
        $('.filter-toggle-btn').text(`Filters (${selectedFilters.length})`);
      }
    } else {
      $("#clear-all-filters").hide();
      $(".selected-filters-container").hide();
      
      // Reset filter button text on mobile
      if (isMobile && $('.filter-toggle-btn').length) {
        $('.filter-toggle-btn').text('Filter Products');
      }
    }

    // Handle individual filter removal (desktop only)
    if (!isMobile) {
      $(".remove-filter").off("click").on("click", function(e) {
        e.preventDefault();
        const filterIndex = $(this).data('filter-index');
        selectedFilters[filterIndex].remove();
        updateSelectedFilters();
        applyFilters();
      });
    }
  }

  function clearAllFilters() {
    // Reset price
    const priceRange = filterAjax.priceRange;
    $("#min_price").val(priceRange.min);
    $("#max_price").val(priceRange.max);
    
    // Reset slider if it exists
    if ($("#price-slider").length) {
      $("#price-slider").slider("values", [parseInt(priceRange.min), parseInt(priceRange.max)]);
    }
    updatePriceDisplay(priceRange.min, priceRange.max);
    
    // Uncheck all checkboxes
    $("#filter-sidebar input[type='checkbox']").prop('checked', false);
    
    // Update display
    updateSelectedFilters();
    
    // Apply filters with current category preserved
    applyFilters();
  }

  function applyFilters(page = 1) {
    if (isFiltering) return;
    
    isFiltering = true;
    showLoading();

    // Get current category - this is the key fix!
    let currentCategory = 0;
    
    // Try to get from container data attribute first
    if ($("#wc-custom-filters-container").data('current-category')) {
      currentCategory = $("#wc-custom-filters-container").data('current-category');
    }
    // Fallback to localized data
    else if (filterAjax.currentCategory) {
      currentCategory = filterAjax.currentCategory;
    }
    // Try to get from body class (WooCommerce sets this)
    else if ($('body').hasClass('product-category')) {
      const bodyClasses = $('body').attr('class').split(' ');
      for (let className of bodyClasses) {
        if (className.startsWith('product-category-')) {
          // This gets the slug, we need to convert it to ID
          break;
        }
      }
    }

    const data = {
      action: "apply_product_filters",
      nonce: filterAjax.nonce,
      paged: page,
      current_category: currentCategory,
      filters: {
        price_min: $("#min_price").val(),
        price_max: $("#max_price").val(),
        categories: $("input[name='categories[]']:checked").map(function () {
          return this.value;
        }).get(),
        sizes: $("input[name='sizes[]']:checked").map(function () {
          return this.value;
        }).get(),
        colors: $("input[name='colors[]']:checked").map(function () {
          return this.value;
        }).get(),
        stock: $("input[name='stock[]']:checked").map(function () {
          return this.value;
        }).get(),
      },
    };

    console.log('Applying filters with data:', data); // Debug log

    $.post(filterAjax.ajaxurl, data)
      .done(function (response) {
        if (response.success) {
          updateProductDisplay(response.data);
          updatePagination(response.data);
          
          // Scroll to products
          if (page === 1 && $('.products').length) {
            $('html, body').animate({
              scrollTop: $('.products').offset().top - 100
            }, 500);
          }
        } else {
          showError('Failed to load products. Please try again.');
          console.error('Filter response error:', response);
        }
      })
      .fail(function (xhr, status, error) {
        showError('Connection error. Please check your internet connection.');
        console.error('AJAX error:', xhr, status, error);
      })
      .always(function () {
        hideLoading();
        isFiltering = false;
      });
  }

  function updateProductDisplay(data) {
    const productsContainer = $('.products');
    
    if (productsContainer.length) {
      productsContainer.html(data.products);
      
      // Update results count
      updateResultsCount(data.found_posts);
      
      // Reinitialize WooCommerce events if needed
      $(document.body).trigger('wc_fragment_refresh');
    }
  }

  function updateResultsCount(count) {
    const resultsText = count === 1 ? '1 result' : `${count} results`;
    
    if ($('.woocommerce-result-count').length) {
      $('.woocommerce-result-count').text(resultsText);
    } else {
      // Create results count if it doesn't exist
      $('.products').before(`<p class="woocommerce-result-count">${resultsText}</p>`);
    }
  }

  function updatePagination(data) {
    // Remove existing pagination
    $('.woocommerce-pagination').remove();
    
    if (data.max_num_pages > 1) {
      let paginationHtml = '<nav class="woocommerce-pagination"><ul class="page-numbers">';
      
      // Previous page
      if (data.current_page > 1) {
        paginationHtml += `<li><a class="prev page-numbers" href="#" data-page="${data.current_page - 1}">Previous</a></li>`;
      }
      
      // Page numbers
      for (let i = 1; i <= data.max_num_pages; i++) {
        if (i === data.current_page) {
          paginationHtml += `<li><span class="page-numbers current">${i}</span></li>`;
        } else {
          paginationHtml += `<li><a class="page-numbers" href="#" data-page="${i}">${i}</a></li>`;
        }
      }
      
      // Next page
      if (data.current_page < data.max_num_pages) {
        paginationHtml += `<li><a class="next page-numbers" href="#" data-page="${data.current_page + 1}">Next</a></li>`;
      }
      
      paginationHtml += '</ul></nav>';
      
      $('.products').after(paginationHtml);
      
      // Handle pagination clicks
      $('.woocommerce-pagination a').on('click', function(e) {
        e.preventDefault();
        const page = $(this).data('page');
        applyFilters(page);
      });
    }
  }

  function showLoading() {
    $("#filter-loading").show();
    $('.products').addClass('filtering');
  }

  function hideLoading() {
    $("#filter-loading").hide();
    $('.products').removeClass('filtering');
  }

  function showError(message) {
    console.error(message);
    alert(message);
  }

  // Initialize everything
  if ($("#filter-sidebar").length) {
    setupMobileElements();
    
    // Wait a bit for DOM to be ready, then initialize slider
    setTimeout(function() {
      initPriceSlider();
      updateSelectedFilters();
    }, 100);
    
    // Load initial filters from URL parameters if needed
    const urlParams = new URLSearchParams(window.location.search);
    
    // Apply URL parameters to filters
    if (urlParams.get('min_price')) {
      $("#min_price").val(urlParams.get('min_price'));
    }
    if (urlParams.get('max_price')) {
      $("#max_price").val(urlParams.get('max_price'));
    }
    
    // Update slider with URL values
    setTimeout(function() {
      const minPrice = parseInt($("#min_price").val()) || parseInt(filterAjax.priceRange.min);
      const maxPrice = parseInt($("#max_price").val()) || parseInt(filterAjax.priceRange.max);
      
      if ($("#price-slider").length) {
        $("#price-slider").slider("values", [minPrice, maxPrice]);
      }
      updatePriceDisplay(minPrice, maxPrice);
    }, 200);
  }

  // Handle browser back/forward buttons
  window.addEventListener('popstate', function(event) {
    if (event.state && event.state.filters) {
      if (isMobile) {
        $('.filter-content-box').removeClass('active');
        $('.filter-toggle-btn').removeClass('active').text('Filter Products');
      }
    }
  });
});

jQuery(document).ready(function ($) {
  let filterTimeout;
  let isFiltering = false;
  let selectedSizes = [];
  let selectedColors = [];
  const isMobile = window.matchMedia('(max-width: 768px)').matches || filterAjax.isMobile;

  // Setup mobile UI elements
  function setupMobileElements() {
    if (isMobile) {
      // Add filter toggle button if it doesn't exist
      if ($('.filter-toggle-btn').length === 0) {
        $('#wc-custom-filters-container').prepend('<button class="filter-toggle-btn">Filter Products</button>');
      }
      
      // Wrap filter content in a box for toggling
      if (!$('#filter-sidebar').parent().hasClass('filter-content-box')) {
        $('#filter-sidebar').wrap('<div class="filter-content-box"></div>');
      }
      
      // Add apply filters button if it doesn't exist
      if ($('.apply-filters-btn').length === 0) {
        $('.filter-content-box').append('<button class="apply-filters-btn">Apply Filters</button>');
      }
    }
  }

  // Initialize price slider
  function initPriceSlider() {
    if (!$('#price-slider').length) return;
    
    const priceRange = filterAjax.priceRange;
    
    // Make sure we have valid price range
    if (!priceRange || priceRange.min === undefined || priceRange.max === undefined) {
      console.error('Price range not available');
      return;
    }
    
    // Ensure jQuery UI is loaded before initializing slider
    if (typeof $.fn.slider === 'undefined') {
      console.error('jQuery UI Slider not loaded');
      return;
    }
    
    $("#price-slider").slider({
      range: true,
      min: parseInt(priceRange.min),
      max: parseInt(priceRange.max),
      values: [parseInt(priceRange.min), parseInt(priceRange.max)],
      slide: function (event, ui) {
        $("#min_price").val(ui.values[0]);
        $("#max_price").val(ui.values[1]);
        updatePriceDisplay(ui.values[0], ui.values[1]);
        
        // Only auto-apply on desktop
        if (!isMobile) {
          clearTimeout(filterTimeout);
          filterTimeout = setTimeout(applyFilters, 500);
        }
      },
    });

    // Set initial values
    $("#min_price").val(priceRange.min);
    $("#max_price").val(priceRange.max);
    updatePriceDisplay(priceRange.min, priceRange.max);
  }

  function updatePriceDisplay(min, max) {
    $("#price-min-display").text("৳" + min);
    $("#price-max-display").text("৳" + max);
  }

  // Handle manual price input
  $("#min_price, #max_price").on("change keyup", function () {
    const priceRange = filterAjax.priceRange;
    const minPrice = parseInt($("#min_price").val()) || parseInt(priceRange.min);
    const maxPrice = parseInt($("#max_price").val()) || parseInt(priceRange.max);
    
    // Update slider if it exists
    if ($("#price-slider").length && typeof $.fn.slider !== 'undefined') {
      $("#price-slider").slider("values", [minPrice, maxPrice]);
    }
    updatePriceDisplay(minPrice, maxPrice);
    
    // Only auto-apply on desktop
    if (!isMobile) {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(applyFilters, 500);
    }
  });

  // Handle checkbox changes (for category and stock)
  $("#filter-sidebar input[type='checkbox']").on("change", function () {
    updateSelectedFilters();
    
    // Only auto-apply on desktop
    if (!isMobile) {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(applyFilters, 300);
    }
  });

  // Handle filter button clicks (for size and color)
  $(document).on('click', '.filter-button', function(e) {
    e.preventDefault();
    
    const button = $(this);
    const value = button.data('value');
    const name = button.data('name');
    const filterType = button.data('filter-type');
    
    button.toggleClass('active');
    
    if (filterType === 'size') {
      if (button.hasClass('active')) {
        if (!selectedSizes.includes(value)) {
          selectedSizes.push(value);
        }
      } else {
        selectedSizes = selectedSizes.filter(size => size !== value);
      }
      $('#selected-sizes').val(selectedSizes.join(','));
    } else if (filterType === 'color') {
      if (button.hasClass('active')) {
        if (!selectedColors.includes(value)) {
          selectedColors.push(value);
        }
      } else {
        selectedColors = selectedColors.filter(color => color !== value);
      }
      $('#selected-colors').val(selectedColors.join(','));
    }
    
    updateSelectedFilters();
    
    // Only auto-apply on desktop
    if (!isMobile) {
      clearTimeout(filterTimeout);
      filterTimeout = setTimeout(applyFilters, 300);
    }
  });

  // Handle see more/less buttons
  $(document).on('click', '.see-more-btn', function(e) {
    e.preventDefault();
    const target = $(this).data('target');
    const container = $('#filter-' + target);
    
    container.find('.filter-item-hidden').removeClass('filter-item-hidden').addClass('filter-item-shown');
    $(this).hide();
    container.find('.see-less-btn[data-target="' + target + '"]').show();
  });

  $(document).on('click', '.see-less-btn', function(e) {
    e.preventDefault();
    const target = $(this).data('target');
    const container = $('#filter-' + target);
    
    container.find('.filter-item-shown').removeClass('filter-item-shown').addClass('filter-item-hidden');
    $(this).hide();
    container.find('.see-more-btn[data-target="' + target + '"]').show();
  });

  // Toggle filter content on mobile
  $(document).on('click', '.filter-toggle-btn', function(e) {
    e.preventDefault();
    $(this).toggleClass('active');
    $('.filter-content-box').toggleClass('active');
    
    // Get current filter count for proper text display
    const filterCount = getActiveFilterCount();
    
    if ($(this).hasClass('active')) {
      $(this).text('Hide Filters');
    } else {
      if (filterCount > 0) {
        $(this).text(`Filters (${filterCount})`);
      } else {
        $(this).text('Filter Products');
      }
    }
  });

  // Apply filters button (mobile)
  $(document).on('click', '.apply-filters-btn', function(e) {
    e.preventDefault();
    applyFilters();
    
    // Hide the filter content box after applying on mobile
    if (isMobile) {
      $('.filter-content-box').removeClass('active');
      const filterCount = getActiveFilterCount();
      
      if (filterCount > 0) {
        $('.filter-toggle-btn').removeClass('active').text(`Filters (${filterCount})`);
      } else {
        $('.filter-toggle-btn').removeClass('active').text('Filter Products');
      }
    }
  });

  // Clear all filters
  $("#clear-all-filters").on("click", function(e) {
    e.preventDefault();
    clearAllFilters();
  });

  // Helper function to get active filter count
  function getActiveFilterCount() {
    let count = 0;
    
    // Price filters
    const minPrice = parseInt($("#min_price").val()) || 0;
    const maxPrice = parseInt($("#max_price").val()) || 0;
    const priceRange = filterAjax.priceRange;
    
    if (minPrice != parseInt(priceRange.min) || maxPrice != parseInt(priceRange.max)) {
      count++;
    }

    // Stock filters
    count += $("input[name='stock[]']:checked").length;

    // Category filters
    count += $("input[name='categories[]']:checked").length;

    // Size filters (button style)
    count += $('.size-button.active').length;

    // Color filters (button style)
    count += $('.color-button.active').length;

    // Checkbox-style size and color filters (fallback)
    count += $("input[name='sizes[]']:checked").length;
    count += $("input[name='colors[]']:checked").length;

    return count;
  }

  function updateSelectedFilters() {
    const selectedFilters = [];
    const activeFiltersList = $("#active-filters-list");
    
    // Price filters
    const minPrice = parseInt($("#min_price").val()) || 0;
    const maxPrice = parseInt($("#max_price").val()) || 0;
    const priceRange = filterAjax.priceRange;
    
    if (minPrice != parseInt(priceRange.min) || maxPrice != parseInt(priceRange.max)) {
      selectedFilters.push({
        type: 'price',
        text: `Price: ৳${minPrice} - ৳${maxPrice}`,
        remove: function() {
          $("#min_price").val(priceRange.min);
          $("#max_price").val(priceRange.max);
          if ($("#price-slider").length && typeof $.fn.slider !== 'undefined') {
            $("#price-slider").slider("values", [parseInt(priceRange.min), parseInt(priceRange.max)]);
          }
          updatePriceDisplay(priceRange.min, priceRange.max);
        }
      });
    }

    // Stock filters
    $("input[name='stock[]']:checked").each(function() {
      selectedFilters.push({
        type: 'stock',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).prop('checked', false);
        }
      });
    });

    // Category filters
    $("input[name='categories[]']:checked").each(function() {
      selectedFilters.push({
        type: 'category',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).prop('checked', false);
        }
      });
    });

    // Size filters (button style)
    $('.size-button.active').each(function() {
      selectedFilters.push({
        type: 'size',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).removeClass('active');
          const value = $(this.element).data('value');
          selectedSizes = selectedSizes.filter(size => size !== value);
          $('#selected-sizes').val(selectedSizes.join(','));
        }
      });
    });

    // Color filters (button style)
    $('.color-button.active').each(function() {
      selectedFilters.push({
        type: 'color',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).removeClass('active');
          const value = $(this.element).data('value');
          selectedColors = selectedColors.filter(color => color !== value);
          $('#selected-colors').val(selectedColors.join(','));
        }
      });
    });

    // Also handle checkbox-style size and color filters (fallback)
    $("input[name='sizes[]']:checked").each(function() {
      selectedFilters.push({
        type: 'size',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).prop('checked', false);
        }
      });
    });

    $("input[name='colors[]']:checked").each(function() {
      selectedFilters.push({
        type: 'color',
        text: $(this).data('name'),
        element: this,
        remove: function() {
          $(this.element).prop('checked', false);
        }
      });
    });

    // Update display
    activeFiltersList.empty();
    
    if (selectedFilters.length > 0) {
      selectedFilters.forEach(function(filter, index) {
        const filterTag = $(`
          <span class="active-filter-tag" data-filter-type="${filter.type}">
            ${filter.text}
            ${!isMobile ? '<button class="remove-filter" data-filter-index="' + index + '">&times;</button>' : ''}
          </span>
        `);
        activeFiltersList.append(filterTag);
      });
      
      $("#clear-all-filters").show();
      $(".selected-filters-container").show();
      
      // Update filter button text with count on mobile - Fixed logic
      if (isMobile && $('.filter-toggle-btn').length) {
        const toggleBtn = $('.filter-toggle-btn');
        // Only update if the filter box is not currently active (open)
        if (!toggleBtn.hasClass('active')) {
          toggleBtn.text(`Filters (${selectedFilters.length})`);
        }
      }
    } else {
      $("#clear-all-filters").hide();
      $(".selected-filters-container").hide();
      
      // Reset filter button text on mobile - Fixed logic  
      if (isMobile && $('.filter-toggle-btn').length) {
        const toggleBtn = $('.filter-toggle-btn');
        // Only update if the filter box is not currently active (open)
        if (!toggleBtn.hasClass('active')) {
          toggleBtn.text('Filter Products');
        }
      }
    }

    // Store selected filters for removal handling
    window.currentSelectedFilters = selectedFilters;

    // Handle individual filter removal (desktop only)
    if (!isMobile) {
      $(".remove-filter").off("click").on("click", function(e) {
        e.preventDefault();
        const filterIndex = $(this).data('filter-index');
        if (window.currentSelectedFilters && window.currentSelectedFilters[filterIndex]) {
          window.currentSelectedFilters[filterIndex].remove();
          updateSelectedFilters();
          applyFilters();
        }
      });
    }
  }

  function clearAllFilters() {
    // Reset price
    const priceRange = filterAjax.priceRange;
    $("#min_price").val(priceRange.min);
    $("#max_price").val(priceRange.max);
    
    // Reset slider if it exists
    if ($("#price-slider").length && typeof $.fn.slider !== 'undefined') {
      $("#price-slider").slider("values", [parseInt(priceRange.min), parseInt(priceRange.max)]);
    }
    updatePriceDisplay(priceRange.min, priceRange.max);
    
    // Uncheck all checkboxes
    $("#filter-sidebar input[type='checkbox']").prop('checked', false);
    
    // Reset button-style filters
    $('.filter-button.active').removeClass('active');
    selectedSizes = [];
    selectedColors = [];
    $('#selected-sizes').val('');
    $('#selected-colors').val('');
    
    // Update display
    updateSelectedFilters();
    
    // Apply filters with current category preserved
    applyFilters();
  }

  function applyFilters(page = 1) {
    if (isFiltering) return;
    
    isFiltering = true;
    showLoading();

    // Get current category - this is the key fix!
    let currentCategory = 0;
    
    // Try to get from container data attribute first
    if ($("#wc-custom-filters-container").data('current-category')) {
      currentCategory = $("#wc-custom-filters-container").data('current-category');
    }
    // Fallback to localized data
    else if (filterAjax.currentCategory) {
      currentCategory = filterAjax.currentCategory;
    }
    // Try to get from body class (WooCommerce sets this)
    else if ($('body').hasClass('product-category')) {
      const bodyClasses = $('body').attr('class').split(' ');
      for (let className of bodyClasses) {
        if (className.startsWith('product-category-')) {
          // This gets the slug, we need to convert it to ID
          break;
        }
      }
    }

    // Collect size and color data from both button and checkbox styles
    let sizeValues = [];
    let colorValues = [];

    // From button-style filters
    if (selectedSizes.length > 0) {
      sizeValues = selectedSizes;
    }
    if (selectedColors.length > 0) {
      colorValues = selectedColors;
    }

    // From checkbox-style filters (fallback/additional)
    const checkboxSizes = $("input[name='sizes[]']:checked").map(function () {
      return this.value;
    }).get();
    const checkboxColors = $("input[name='colors[]']:checked").map(function () {
      return this.value;
    }).get();

    // Merge arrays and remove duplicates
    sizeValues = [...new Set([...sizeValues, ...checkboxSizes])];
    colorValues = [...new Set([...colorValues, ...checkboxColors])];

    const data = {
      action: "apply_product_filters",
      nonce: filterAjax.nonce,
      paged: page,
      current_category: currentCategory,
      filters: {
        price_min: $("#min_price").val(),
        price_max: $("#max_price").val(),
        categories: $("input[name='categories[]']:checked").map(function () {
          return this.value;
        }).get(),
        sizes: sizeValues,
        colors: colorValues,
        stock: $("input[name='stock[]']:checked").map(function () {
          return this.value;
        }).get(),
      },
    };

    console.log('Applying filters with data:', data); // Debug log

    $.post(filterAjax.ajaxurl, data)
      .done(function (response) {
        if (response.success) {
          updateProductDisplay(response.data);
          updatePagination(response.data);
          
          // Scroll to products
          if (page === 1 && $('.products').length) {
            $('html, body').animate({
              scrollTop: $('.products').offset().top - 100
            }, 500);
          }
        } else {
          showError('Failed to load products. Please try again.');
          console.error('Filter response error:', response);
        }
      })
      .fail(function (xhr, status, error) {
        showError('Connection error. Please check your internet connection.');
        console.error('AJAX error:', xhr, status, error);
      })
      .always(function () {
        hideLoading();
        isFiltering = false;
      });
  }

  function updateProductDisplay(data) {
    const productsContainer = $('.products');
    
    if (productsContainer.length) {
      productsContainer.html(data.products);
      
      // Update results count
      updateResultsCount(data.found_posts);
      
      // Reinitialize WooCommerce events if needed
      $(document.body).trigger('wc_fragment_refresh');
    }
  }

  function updateResultsCount(count) {
    const resultsText = count === 1 ? '1 result' : `${count} results`;
    
    if ($('.woocommerce-result-count').length) {
      $('.woocommerce-result-count').text(resultsText);
    } else {
      // Create results count if it doesn't exist
      $('.products').before(`<p class="woocommerce-result-count">${resultsText}</p>`);
    }
  }

  function updatePagination(data) {
    // Remove existing pagination
    $('.woocommerce-pagination').remove();
    
    if (data.max_num_pages > 1) {
      let paginationHtml = '<nav class="woocommerce-pagination"><ul class="page-numbers">';
      
      // Previous page
      if (data.current_page > 1) {
        paginationHtml += `<li><a class="prev page-numbers" href="#" data-page="${data.current_page - 1}">Previous</a></li>`;
      }
      
      // Page numbers
      for (let i = 1; i <= data.max_num_pages; i++) {
        if (i === data.current_page) {
          paginationHtml += `<li><span class="page-numbers current">${i}</span></li>`;
        } else {
          paginationHtml += `<li><a class="page-numbers" href="#" data-page="${i}">${i}</a></li>`;
        }
      }
      
      // Next page
      if (data.current_page < data.max_num_pages) {
        paginationHtml += `<li><a class="next page-numbers" href="#" data-page="${data.current_page + 1}">Next</a></li>`;
      }
      
      paginationHtml += '</ul></nav>';
      
      $('.products').after(paginationHtml);
      
      // Handle pagination clicks
      $('.woocommerce-pagination a').on('click', function(e) {
        e.preventDefault();
        const page = $(this).data('page');
        applyFilters(page);
      });
    }
  }

  function showLoading() {
    $("#filter-loading").show();
    $('.products').addClass('filtering');
  }

  function hideLoading() {
    $("#filter-loading").hide();
    $('.products').removeClass('filtering');
  }

  function showError(message) {
    console.error(message);
    alert(message);
  }

  // Initialize everything
  if ($("#filter-sidebar").length) {
    setupMobileElements();
    
    // Wait a bit for DOM to be ready, then initialize slider
    setTimeout(function() {
      initPriceSlider();
      updateSelectedFilters();
    }, 100);
    
    // Load initial filters from URL parameters if needed
    const urlParams = new URLSearchParams(window.location.search);
    
    // Apply URL parameters to filters
    if (urlParams.get('min_price')) {
      $("#min_price").val(urlParams.get('min_price'));
    }
    if (urlParams.get('max_price')) {
      $("#max_price").val(urlParams.get('max_price'));
    }
    
    // Update slider with URL values
    setTimeout(function() {
      const minPrice = parseInt($("#min_price").val()) || parseInt(filterAjax.priceRange.min);
      const maxPrice = parseInt($("#max_price").val()) || parseInt(filterAjax.priceRange.max);
      
      if ($("#price-slider").length && typeof $.fn.slider !== 'undefined') {
        $("#price-slider").slider("values", [minPrice, maxPrice]);
      }
      updatePriceDisplay(minPrice, maxPrice);
    }, 200);
  }

  // Handle browser back/forward buttons
  window.addEventListener('popstate', function(event) {
    if (event.state && event.state.filters) {
      if (isMobile) {
        $('.filter-content-box').removeClass('active');
        $('.filter-toggle-btn').removeClass('active').text('Filter Products');
      }
    }
  });
});